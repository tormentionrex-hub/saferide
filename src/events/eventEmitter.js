const EventEmitter = require('events');
const logger = require('../utils/logger');

class AppEventEmitter extends EventEmitter {}

const eventEmitter = new AppEventEmitter();

eventEmitter.on('newListener', (event) => {
    logger.debug(`New listener added for event: ${event}`);
});

module.exports = eventEmitter;

