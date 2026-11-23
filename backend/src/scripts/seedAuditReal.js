require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const { AuditLog, User, Complaint, Document } = require('../models');

const actorFor = (admin) => ({
    adminEmail: admin?.email || 'admin@saferide.cr',
    ipAddress: '127.0.0.1',
    userAgent: 'SafeRide Admin Panel / backend',
});

const seedAudit = async () => {
    await connectDB();

    const admin = await User.findOne({ email: process.env.ADMIN_EMAIL?.trim().toLowerCase() })
        || await User.findOne({ type: 'admin' });
    const actor = actorFor(admin);

    const [complaint, needsReview, processing, approved, rejected] = await Promise.all([
        Complaint.findOne().sort({ createdAt: -1 }),
        Document.find({ status: 'needs_review' }).sort({ createdAt: -1 }).limit(2),
        Document.find({ status: 'processing' }).sort({ createdAt: -1 }).limit(2),
        Document.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(2),
        Document.find({ status: 'rejected' }).sort({ createdAt: -1 }).limit(2),
    ]);

    const entries = [];

    if (complaint) {
        entries.push({
            ...actor,
            action: 'COMPLAINT_RESOLVED',
            targetType: 'complaint',
            details: `Marcó como atendida la queja ${complaint._id}: ${complaint.subject || complaint.title || 'Queja registrada'}`,
        });
    }
    for (const doc of needsReview) {
        entries.push({
            ...actor,
            action: 'DOCUMENT_RESEND_REQUESTED',
            targetType: 'document',
            details: `Solicitó reenvío del documento ${doc.type} (${doc._id})`,
        });
    }
    for (const doc of processing) {
        entries.push({
            ...actor,
            action: 'DOCUMENT_REPROCESSED',
            targetType: 'document',
            details: `Reprocesó el documento ${doc.type} (${doc._id})`,
        });
    }
    for (const doc of approved) {
        entries.push({
            ...actor,
            action: 'DOCUMENT_APPROVED',
            targetType: 'document',
            details: `Aprobó el documento ${doc.type} (${doc._id})`,
        });
    }
    for (const doc of rejected) {
        entries.push({
            ...actor,
            action: 'DOCUMENT_REJECTED',
            targetType: 'document',
            details: `Rechazó el documento ${doc.type} (${doc._id})`,
        });
    }

    let created = 0;
    let skipped = 0;
    for (const entry of entries) {
        const exists = await AuditLog.exists({ action: entry.action, details: entry.details });
        if (exists) {
            skipped++;
            continue;
        }
        await AuditLog.create(entry);
        created++;
    }

    console.log(`Auditoría real: ${created} nuevos, ${skipped} ya existentes.`);
    await mongoose.disconnect();
};

seedAudit().catch(async (error) => {
    console.error(`No se pudo generar la auditoría: ${error.message}`);
    try {
        await mongoose.disconnect();
    } catch (disconnectError) {
        console.error(disconnectError.message);
    }
    process.exitCode = 1;
});
