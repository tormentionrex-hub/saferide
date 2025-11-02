const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
        };
        // Construir connection string para Cosmos DB con MongoDB API
        const conn = process.env.COSMOS_ENDPOINT.includes('mongodb')
            ? process.env.COSMOS_ENDPOINT
            : `mongodb://${process.env.COSMOS_ENDPOINT.replace('https://', '').replace(':443/', '')}
            :10255/${process.env.COSMOS_DATABASE}?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=
            @${process.env.COSMOS_ENDPOINT.split('.')[0].replace('https://','')}@`;
            await mongoose.connect(conn, options);

            console.log('✅ Cosmos DB connected successfully');
            // Event listeners
            mongoose.connection.on('error', (err)=>{
                console.error('❌ MongoDB connection error:', err);
            });
            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
            });



    } catch (error) {
        console.error('❌ Error connecting to Cosmos DB:', error.message);
        process.exit(1);
    }
};
module.exports = connectDB;