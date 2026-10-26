const mongoose = require('mongoose');
const logger = require('../utils/logger');
require('dotenv').config();

const connectDB = async () => {
  try {
    // Connection string for Cosmos DB for MongoDB (vCore)
    let connectionString = process.env.COSMOS_CONNECTION_STRING;
    const dbName = process.env.COSMOS_DATABASE || 'Safe-RideDB';

    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING is not defined in environment variables');
    }

    // Ensure the connection string includes the database name
    // If the URL does not have a path (ends in .com/ or does not have /), add the database name
    if (!connectionString.includes('?')) {
      // No query string, add /<dbname>?
      connectionString = connectionString.replace(/\/?$/, `/${dbName}?`);
    } else if (!connectionString.match(/\/[^\/]+\?/)) {
      // There is a query string but no database name between / and ?
      connectionString = connectionString.replace('?', `/${dbName}?`);
    }

    // Connection options optimized for Cosmos DB vCore or Local MongoDB
    const options = {
      // Specify the database name explicitly
      dbName: dbName,

      // Timeout configurations
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 10000, // 10 seconds

      // Connection pool
      maxPoolSize: 10, // Maximum simultaneous connections
      minPoolSize: 2,  // Minimum connections in the pool

      // Retry configuration
      retryWrites: false, // Cosmos DB vCore does not support retryWrites by default
      retryReads: true,

      // Additional settings
      maxIdleTimeMS: 120000, // 2 minutes
    };

    // If connecting to a remote Azure Cosmos DB, add TLS and Auth options
    if (connectionString.includes('mongodb.net') || connectionString.includes('azure')) {
      options.tls = true;
      options.tlsAllowInvalidCertificates = false;
      options.authSource = 'admin';
      options.authMechanism = 'SCRAM-SHA-256';
      options.compressors = ['zlib'];
    }

    // Conectar a la base de datos
    await mongoose.connect(connectionString, options);

    logger.success('✅ Cosmos DB for MongoDB (vCore) connected successfully');
    logger.info(`📊 Database: ${mongoose.connection.name}`);
    logger.info(`🌐 Host: ${mongoose.connection.host}`);

    // Event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.success('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Error connecting to Cosmos DB:', error);

    // Log additional error details
    if (error.message.includes('authentication')) {
      logger.error('Authentication failed. Check your username and password.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      logger.error('Network error. Check your connection string and firewall settings.');
    }

    // Exit process with failure
    process.exit(1);
  }
};

// Helper function to check database connection status
const checkConnection = () => {
  return mongoose.connection.readyState === 1;
};

// Helper function to get connection stats
const getConnectionStats = () => {
  return {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.connection.models),
  };
};

module.exports = {
  connectDB,
  checkConnection,
  getConnectionStats,
};