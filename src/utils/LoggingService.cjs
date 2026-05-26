/**
 * @fileoverview Утилита для централизованного логирования в системе.
 * Обеспечивает стандартизированный способ записи логов в разных частях приложения.
 */

const LEVEL = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
};

/**
 * Логирует сообщение с заданным уровнем важности.
 * @param {string} level - Уровень логирования (DEBUG, INFO, WARN, ERROR, FATAL).
 * @param {string} message - Сообщение для логирования.
 * @param {object} [metadata={}] - Дополнительные метаданные.
 */
function log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    let output = `[${timestamp}] [${level}] ${message}`;
    
    if (Object.keys(metadata).length > 0) {
        output += ' | Metadata: ' + JSON.stringify(metadata);
    }

    // В реальном приложении здесь бы использовалось io.write или console.error/log
    if (level === LEVEL.ERROR || level === LEVEL.FATAL) {
        console.error(output);
    } else {
        console.log(output);
    }
}

/**
 * Фасадные методы для удобного использования.
 * @example
 * logDebug('Пользователь вошел в систему', { userId: 123 });
 */
module.exports = {
    LEVEL,
    logDebug: (message, metadata) => log(LEVEL.DEBUG, message, metadata),
    logInfo: (message, metadata) => log(LEVEL.INFO, message, metadata),
    logWarn: (message, metadata) => log(LEVEL.WARN, message, metadata),
    logError: (message, metadata) => log(LEVEL.ERROR, message, metadata),
    logFatal: (message, metadata) => log(LEVEL.FATAL, message, metadata)
};