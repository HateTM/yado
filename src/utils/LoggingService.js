/**
 * @fileoverview Centralized logging service for standardized logging across the application.
 * Provides methods for structured logging of information, warnings, and errors.
 * All services should use this module for consistent logging.
 * @module LoggingService
 */

/**
 * Defines the standard log levels for the application.
 * @readonly
 * @enum {string}
 */
const LogLevel = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
};

/**
 * Standardized logging function.
 * @param {LogLevel} level - The severity level of the log (INFO, WARN, ERROR, DEBUG).
 * @param {string} message - The primary message describing the event.
 * @param {object} [context={}] - Additional context data (e.g., function name, object details).
 * @returns {string} A formatted log message string.
 */
function log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    let output = `[${timestamp}] [${level}] ${message}`;

    if (Object.keys(context).length > 0) {
        output += ` | Context: ${JSON.stringify(context)}`;
    }

    // In a real application, this would write to a structured logger (e.g., Winston, pino)
    // For this exercise, we simply log the formatted string to simulate centralized logging.
    console.log(output);
    return output;
}

/**
 * Logs an informational message.
 * @param {string} message - The message to log.
 * @param {object} [context={}] - Contextual data for the log.
 * @returns {string} The formatted log message.
 */
function info(message, context = {}) {
    return log(LogLevel.INFO, message, context);
}

/**
 * Logs a warning message.
 * @param {string} message - The message to log.
 * @param {object} [context={}] - Contextual data for the log.
 * @returns {string} The formatted log message.
 */
function warn(message, context = {}) {
    return log(LogLevel.WARN, message, context);
}

/**
 * Logs an error message.
 * @param {string} message - The message describing the error.
 * @param {Error} error - The actual Error object (optional).
 * @param {object} [context={}] - Contextual data for the log.
 * @returns {string} The formatted log message.
 */
function error(message, error = null, context = {}) {
    const fullContext = { ...context };
    if (error) {
        fullContext.errorName = error.name;
        fullContext.errorMessage = error.message;
        // Optionally stack trace: fullContext.stack = error.stack;
    }
    return log(LogLevel.ERROR, message, fullContext);
}

/**
 * Logs a detailed debug message.
 * @param {string} message - The message to log.
 * @param {object} [context={}] - Contextual data for the log.
 * @returns {string} The formatted log message.
 */
function debug(message, context = {}) {
    return log(LogLevel.DEBUG, message, context);
}


module.exports = {
    LogLevel,
    info,
    warn,
    error,
    debug,
    log
};
