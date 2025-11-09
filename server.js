const app = require('./src/app');
const { connectDB } = require('./src/config/database');
const { initScheduledJobs } = require('./src/jobs/scheduledJobs');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 8080;

// Función principal para iniciar el servidor
const startServer = async () => {
  try {
    // Conectar a la base de datos primero
    await connectDB();

    // Inicializar tareas programadas
    if (process.env.NODE_ENV !== 'test') {
      initScheduledJobs();
    }

    // Iniciar servidor después de la conexión exitosa
    const server = app.listen(PORT, () => {
      logger.success(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`📡 API Version: ${process.env.API_VERSION || 'v1'}`);
      logger.info(`🔗 URL: http://localhost:${PORT}`);
      logger.info(`📊 Health Check: http://localhost:${PORT}/api/v1/health`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Promise Rejection:', err);
      server.close(() => {
        logger.info('Server closed due to unhandled rejection');
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      server.close(() => {
        logger.info('Server closed due to uncaught exception');
        process.exit(1);
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Iniciar el servidor
startServer();