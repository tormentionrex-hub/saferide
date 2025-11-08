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

        let conn = null;

        // 1) If COSMOS_CONNECTION_STRING provided, use it directly.
        if (process.env.COSMOS_CONNECTION_STRING) {
            conn = process.env.COSMOS_CONNECTION_STRING;
        }
        // 2) If COSMOS_ENDPOINT already contains a mongodb:// connection string, use it.
        else if (process.env.COSMOS_ENDPOINT && process.env.COSMOS_ENDPOINT.includes('mongodb')) {
            conn = process.env.COSMOS_ENDPOINT;
        }
        // 3) Otherwise construct from endpoint + database + key (password).
        else if (process.env.COSMOS_ENDPOINT && process.env.COSMOS_DATABASE && process.env.COSMOS_KEY) {
            // Normalize endpoint to host (remove protocol, trailing slash and optional port)
            let host = process.env.COSMOS_ENDPOINT.replace(/^https?:\/\//, '').replace(/\/$/, '');
            host = host.split('/')[0].replace(/:\d+$/, '');

            const db = process.env.COSMOS_DATABASE;
            const pass = encodeURIComponent(process.env.COSMOS_KEY);

            // Determine username:
            // - Prefer COSMOS_USERNAME if provided
            // - Otherwise fall back to account name (first label of host)
            const account = host.split('.')[0];
            const user = encodeURIComponent(process.env.COSMOS_USERNAME || account);

            // Build Cosmos DB (MongoDB API) connection string (Azure typically listens on port 10255)
            conn = `mongodb://${user}:${pass}@${host}:10255/${db}?ssl=true&replicaSet=globaldb&retryWrites=false&maxIdleTimeMS=120000&appName=@${account}@&authSource=admin`;
        } else {
            throw new Error(
                'Cosmos DB configuration missing. Provide COSMOS_CONNECTION_STRING, or COSMOS_ENDPOINT + COSMOS_DATABASE + COSMOS_KEY (optionally COSMOS_USERNAME).'
            );
        }

        await mongoose.connect(conn, options);

        console.log('✅ Cosmos DB connected successfully');

        mongoose.connection.on('error', (err) => {
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