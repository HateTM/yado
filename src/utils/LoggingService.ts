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
    // Убрана неиспользуемая переменная structuredLog для устранения предупреждения TypeScript.

    // Для симуляции выводим и структурированный JSON (лучшая практика), и старый формат.
    // В реальном приложении следует использовать только JSON-вывод.
    console.log("Structured JSON log:", {
        timestamp: timestamp,
        level: consolePrefix,
        message: message,
        metadata: metadata,
    });
    const logMessage = `[${timestamp}] [${consolePrefix.toUpperCase().padEnd(5)}] ${message}`;
    consoleMethod(logMessage, metadata);




}
