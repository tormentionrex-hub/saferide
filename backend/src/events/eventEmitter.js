const EventEmitter = require('events');
const logger = require('../utils/logger');

// Custom Event Emitter for the application
class AppEventEmitter extends EventEmitter {}
// Create a singleton instance
const eventEmitter = new AppEventEmitter();
// Log when a new listener is added
eventEmitter.on('newListener', (event) => {
    logger.debug(`New listener added for event: ${event}`);
});

module.exports = eventEmitter;

