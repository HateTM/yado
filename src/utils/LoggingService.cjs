/**
 * @fileoverview Централизованная служба логирования.
 */

const LEVEL = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
};

function log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    let output = `[${timestamp}] [${level}] ${message}`;


    if (Object.keys(metadata).length > 0) {
        output += ' | Metadata: ' + JSON.stringify(metadata);
    }

    if (level === LEVEL.ERROR || level === LEVEL.FATAL) {
        console.error(output);
    } else {
        console.log(output);
    }
}

module.exports = {
    LEVEL,
    logDebug: (message, metadata) => log(LEVEL.DEBUG, message, metadata),
    logInfo: (message, metadata) => log(LEVEL.INFO, message, metadata),
    logWarn: (message, metadata) => log(LEVEL.WARN, message, metadata),
    logError: (message, metadata) => log(LEVEL.ERROR, message, metadata),
    logFatal: (message, metadata) => log(LEVEL.FATAL, message, metadata)
};
