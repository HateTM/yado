/**
 * @file LoggingService.ts
 * @description Centralized logging service for standardizing log messages across the application.
 * Provides consistent logging levels and context.
 */

/**
 * Defines the possible logging levels.
 */
export enum LogLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    DEBUG = 'debug',
}

// Type guard for LogLevel to ensure safety
export function isLogLevel(level: string): level is LogLevel {
    return (Object.values(LogLevel) as string[]).includes(level);
}

/**
 * Standardizes logging output to include timestamps and service context.
 * NOTE: In a production application, this function should return a structured object 
 * (e.g., JSON) suitable for log aggregation tools (like ELK stack).
 * @param level The logging level.
 * @param message The core message content.
 * @param metadata Optional additional context data (structured logging).
 */
export function log(level: LogLevel, message: string, metadata: object = {}) {
    const timestamp = new Date().toISOString();
    
    // --- Simulation Logging ---
    // Use console methods for simulation compatibility.
    let consoleMethod: typeof console.log = console.log;
    let consolePrefix = '';

    switch (level) {
        case LogLevel.ERROR:
            consoleMethod = console.error;
            consolePrefix = 'ERROR';
            break;
        case LogLevel.WARN:
            consoleMethod = console.warn;
            consolePrefix = 'WARN';
            break;
        case LogLevel.DEBUG:
            // Only log debug messages if a specific debug environment flag is set (simulated)
            if (process.env.DEBUG_MODE !== 'true') {
                return;
            }
            consolePrefix = 'DEBUG';
            break;
        default:
            consolePrefix = 'INFO';
    }
    
    // Structured Log Format: { timestamp, level, message, metadata }
    // Убрана unused переменная structuredLog
    
    // For simulation, output both the structured JSON (better practice) and the old format.
    // In a real app, ONLY the JSON output should be used.
    const logMessage = `[${timestamp}] [${consolePrefix.toUpperCase().padEnd(5)}] ${message}`;
    consoleMethod(logMessage, metadata);
}

/**
 * Convenience function for logging informational messages.
 * @param message Message content.
 * @param metadata Optional additional context data.
 */
export const info = (message: string, metadata: object = {}) => log(LogLevel.INFO, message, metadata);

/**
 * Convenience function for logging warnings.
 * @param message Message content.
 * @param metadata Optional additional context data.
 */
export const warn = (message: string, metadata: object = {}) => log(LogLevel.WARN, message, metadata);

/**
 * Convenience function for logging errors.
 * @param message The primary message content describing the error.
 * @param error The actual Error object, if available.
 * @param metadata Optional additional context data.
 */
export const error = (message: any, error: Error | any = null, metadata: object = {}) => {
    // 1. Coerce the user message to a string for safe handling.
    const messageString: string = String(message);
    let combinedMessage: string = messageString;
    let finalMetadata: object = { ...metadata };

    if (error instanceof Error) {
        // 2. Construct the error suffix and prepend "Error: ".
        const errorMessageSuffix: string = `Error: ${error.message}`;

        // 3. Combine message and error suffix robustly.
        combinedMessage = `${messageString}${errorMessageSuffix ? ` ${errorMessageSuffix}` : ''}`.trim();

        // 4. Add the stack trace and raw error object to the metadata for debugging context.
        finalMetadata = { 
            ...metadata, 
            stack: error.stack,
            // Adding raw error object might be helpful for advanced consumers
            rawError: error
        };
    } else if (error && typeof error !== 'string' && error !== null) {
        // Handle non-Error objects passed as the second argument (e.g., number, array, object)
        finalMetadata = { ...metadata, nonErrorContext: String(error) };
        combinedMessage = messageString; // Use original message if error type is unexpected
    }
    
    // 5. Log the combined, type-safe message string and expanded metadata.
    log(LogLevel.ERROR, combinedMessage, finalMetadata);
};
