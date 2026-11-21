/**
 * sync_complaints.cjs
 * 
 * Agente Inteligente de Sincronización SafeRide (MODO SERVIDOR).
 * Este script actúa como un orquestador entre Gmail y el Admin Panel.
 */

require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

// Configuración
const PORT = 3001;
const COMPLAINTS_FILE = path.join(__dirname, '../src/data/complaints.json');

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });

const imapConfig = {
    user: process.env.SUPPORT_EMAIL || 'saferidefwd@gmail.com',
    password: process.env.SUPPORT_EMAIL_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    connTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false }
};

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
        user: process.env.SUPPORT_EMAIL || 'saferidefwd@gmail.com',
        pass: process.env.SUPPORT_EMAIL_PASSWORD,
    },
});

const app = express();
app.use(cors());
app.use(express.json());

// --- LÓGICA DE IA ---
async function processEmailWithAI(mail, uid) {
    const id = `CMP-${Date.now().toString().slice(-4)}-${uid}`;
    const prompt = `
        Actúa como un Analista de Soporte de SafeRide. 
        Analiza el correo y extrae JSON puro:
        Asunto: ${mail.subject} | Mensaje: ${mail.text}
        Esquema: { "category": "Pagos|Conducta|Seguridad|Soporte Técnico", "tripId": "string", "subject": "string", "message": "string" }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiData = JSON.parse(response.text().replace(/```json/g, '').replace(/```/g, '').trim());
        return {
            id, uid,
            user: mail.from.value[0].name || mail.from.value[0].address.split('@')[0],
            email: mail.from.value[0].address,
            ...aiData,
            fullMessage: mail.text,
            status: "Pendiente",
            createdAt: mail.date || new Date().toISOString()
        };
    } catch (e) {
        return { id, uid, user: "Usuario", email: mail.from.value[0].address, category: "Soporte Técnico", tripId: "N/A", subject: mail.subject, message: mail.text.slice(0, 100), fullMessage: mail.text, status: "Pendiente", createdAt: new Date() };
    }
}

// --- LÓGICA DE AUTORESPUESTA ---
const AUTOREPLIES_FILE = path.join(__dirname, 'sent_autoreplies.json');

function getSentAutoreplies() {
    try {
        if (fs.existsSync(AUTOREPLIES_FILE)) {
            return JSON.parse(fs.readFileSync(AUTOREPLIES_FILE, 'utf8'));
        }
    } catch (e) {
        console.error("Error al leer autorepuestas enviadas:", e);
    }
    return [];
}

function saveSentAutoreply(uid) {
    const sent = getSentAutoreplies();
    if (!sent.includes(uid)) {
        sent.push(uid);
        try {
            fs.writeFileSync(AUTOREPLIES_FILE, JSON.stringify(sent, null, 2));
        } catch (e) {
            console.error("Error al guardar autorepuesta enviada:", e);
        }
    }
}

async function sendAutoReply(toEmail, caseId, originalSubject) {
    const mailOptions = {
        from: `"Soporte SafeRide" <${process.env.SUPPORT_EMAIL || 'saferidefwd@gmail.com'}>`,
        to: toEmail,
        subject: `[SafeRide] Recepción de Reporte: ${originalSubject}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px;">
                <div style="background: #2563EB; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px;">SafeRide - Recepción de Reporte</h2>
                </div>
                <div style="padding: 24px; background: #F8FAFC; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px; font-weight: 600; color: #0F172A; margin-top: 0;">¡Hola!</p>
                    <p style="font-size: 15px; color: #334155;">
                        Hemos recibido tu reporte en nuestro sistema de atención. Queremos informarte que <strong>tu caso ya se encuentra en revisión</strong> por nuestro equipo de soporte técnico y atención al cliente.
                    </p>
                    <p style="font-size: 15px; color: #334155;">
                        <strong>Detalles preliminares de tu caso:</strong>
                    </p>
                    <ul style="background: white; padding: 16px 24px; border-radius: 8px; border: 1px solid #E2E8F0; list-style-type: none; margin: 0 0 20px 0; padding-left: 20px;">
                        <li style="margin-bottom: 8px; font-size: 14px; color: #475569;"><strong>ID de Seguimiento:</strong> ${caseId}</li>
                        <li style="margin-bottom: 8px; font-size: 14px; color: #475569;"><strong>Asunto:</strong> ${originalSubject}</li>
                        <li style="font-size: 14px; color: #475569;"><strong>Estado:</strong> En Revisión</li>
                    </ul>
                    <p style="font-size: 15px; color: #334155;">
                        Un miembro de nuestro equipo se pondrá en contacto contigo a la brevedad posible para darte una solución detallada. Agradecemos tu paciencia y preferencia para mantener a SafeRide seguro y de primera calidad.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 24px 0;">
                    <p style="font-size: 12px; color: #64748B; text-align: center; margin-bottom: 0;">
                        Este es un correo automático enviado por el Agente de Soporte de SafeRide. Por favor no respondas a este mensaje.<br>
                        © 2026 SafeRide S.A. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✉️ Autorespuesta enviada automáticamente a ${toEmail} para el caso ${caseId}`);
}

// --- FUNCIONES DEL AGENTE ---
function syncWithGmail(res) {
    const imap = new Imap(imapConfig);
    imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
            if (err) return res?.status(500).json({ error: err.message });
            imap.search(['UNSEEN'], (err, results) => {
                if (!results || !results.length) {
                    fs.writeFileSync(COMPLAINTS_FILE, JSON.stringify([], null, 2));
                    res?.json([]);
                    return imap.end();
                }
                const f = imap.fetch(results, { bodies: '' });
                const complaints = [];
                let completed = 0;
                f.on('message', (msg) => {
                    let uid;
                    msg.once('attributes', (a) => uid = a.uid);
                    msg.on('body', (s) => {
                        simpleParser(s, async (e, m) => {
                            const processed = await processEmailWithAI(m, uid);
                            complaints.push(processed);

                            // Lógica de autorepuesta
                            const sentList = getSentAutoreplies();
                            if (!sentList.includes(uid)) {
                                try {
                                    await sendAutoReply(processed.email, processed.id, m.subject);
                                    saveSentAutoreply(uid);
                                } catch (err) {
                                    console.error(`Error al enviar autorepuesta a ${processed.email} para UID ${uid}:`, err);
                                }
                            }

                            if (++completed === results.length) {
                                fs.writeFileSync(COMPLAINTS_FILE, JSON.stringify(complaints, null, 2));
                                res?.json(complaints);
                                imap.end();
                            }
                        });
                    });
                });
            });
        });
    });
    imap.once('error', (e) => res?.status(500).json({ error: e.message }));
    imap.connect();
}

// --- ENDPOINTS ---
app.get('/api/sync', (req, res) => {
    console.log('🔄 Sincronizando...');
    syncWithGmail(res);
});

app.post('/api/resolve/:uid', (req, res) => {
    const uid = parseInt(req.params.uid);
    const imap = new Imap(imapConfig);
    imap.once('ready', () => {
        imap.openBox('INBOX', false, () => {
            imap.addFlags(uid, ['\\Seen'], (err) => {
                imap.end();
                if (err) return res.status(500).json({ error: err.message });
                console.log(`✅ UID ${uid} resuelto.`);
                res.json({ success: true });
            });
        });
    });
    imap.connect();
});

app.post('/api/reply', async (req, res) => {
    const { to, subject, message } = req.body;
    
    if (!to || !subject || !message) {
        return res.status(400).json({ error: 'Faltan destinatario, asunto o mensaje.' });
    }

    try {
        const mailOptions = {
            from: `"Soporte SafeRide" <${process.env.SUPPORT_EMAIL || 'saferidefwd@gmail.com'}>`,
            to: to,
            subject: `Re: ${subject}`,
            text: message,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                    <div style="background: #2563EB; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; font-size: 18px;">Respuesta de Soporte SafeRide</h2>
                    </div>
                    <div style="padding: 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 8px 8px; background: #F8FAFC;">
                        <p style="white-space: pre-wrap; font-size: 15px; color: #1E293B;">${message}</p>
                        <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 20px 0;">
                        <p style="font-size: 12px; color: #64748B;">Este es un correo automático enviado en respuesta a su reporte. Por favor no responda directamente a este mensaje.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✉️ Correo de respuesta enviado a ${to}`);
        res.json({ success: true, message: 'Correo enviado con éxito.' });
    } catch (err) {
        console.error('Error al enviar correo de respuesta:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🤖 Servidor Agente SafeRide en http://localhost:${PORT}`);
    console.log(`📡 Modo Autopiloto: Sincronizando con Gmail cada 5 minutos...`);

    // Sincronización inicial
    syncWithGmail();

    // Sincronización automática cada 5 minutos
    setInterval(() => {
        console.log('⏰ [Autopiloto] Iniciando sincronización periódica...');
        syncWithGmail();
    }, 300000);
});
