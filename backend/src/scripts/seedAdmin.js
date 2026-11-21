require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB } = require('../config/database');

const seedAdmin = async () => {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME?.trim();
    const username = process.env.ADMIN_USERNAME?.trim();

    const missing = [];
    if (!email) missing.push('ADMIN_EMAIL');
    if (!password) missing.push('ADMIN_PASSWORD');
    if (!name) missing.push('ADMIN_NAME');
    if (!username) missing.push('ADMIN_USERNAME');
    if (missing.length) {
        throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error('ADMIN_EMAIL no es un correo válido');
    }
    if (password.length < 8) {
        throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres');
    }
    if (name.length < 4) {
        throw new Error('ADMIN_NAME debe tener al menos 4 caracteres');
    }
    if (username.length < 4) {
        throw new Error('ADMIN_USERNAME debe tener al menos 4 caracteres');
    }

    await connectDB();

    let admin = await User.findOne({ email });
    if (!admin) {
        admin = new User({ email });
    }

    admin.name = name;
    admin.username = username;
    admin.type = 'admin';
    admin.isActive = true;
    admin.password = password;
    await admin.save();

    console.log(`Admin listo: ${admin.email} (${admin._id})`);
    await mongoose.disconnect();
};

seedAdmin().catch(async (error) => {
    console.error(`No se pudo crear el admin: ${error.message}`);
    try {
        await mongoose.disconnect();
    } catch (disconnectError) {
        console.error(disconnectError.message);
    }
    process.exitCode = 1;
});
