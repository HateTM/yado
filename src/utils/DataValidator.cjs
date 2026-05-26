/**
 * @fileoverview Валидатор данных для проверки структуры метаданных.
 */

class DataValidator {
    /**
     * Проверяет структуру метаданных файла и возвращает результат с деталями.
     * @param {Object} meta - Метаданные файла.
     * @returns {Object} Объект с флагом валидности и списком ошибок.
     */
    static validateFileMetadata(meta) {
        const errors = [];

        // Базовая проверка существования и типа
        if (!meta) {
            errors.push('Metadata is undefined or null');
            return { isValid: false, errors };
        }

        if (typeof meta !== 'object') {
            errors.push('Metadata must be an object');
            return { isValid: false, errors };
        }

        // Проверка обязательных путей
        if (!meta.relativePath && !meta.path) {
            errors.push('Missing both relativePath and path');
        } else if (meta.relativePath === '' || meta.path === '') {
            errors.push('relativePath or path is an empty string');
        }

        // Проверка размера файла (если присутствует)
        if ('size' in meta) {
            if (typeof meta.size !== 'number' || meta.size < 0) {
                errors.push('Invalid size: must be a non-negative number');
            }
        }

        // Проверка времени модификации (если присутствует)
        if ('mtime' in meta) {
            const mtime = new Date(meta.mtime);
            if (isNaN(mtime.getTime())) {
                errors.push('Invalid mtime: not a valid date');
            }
        }

        // Проверка расширения файла (если присутствует)
        if ('extension' in meta && typeof meta.extension !== 'string') {
            errors.push('Invalid extension: must be a string');
        }

        // Проверка других потенциально важных полей
        if ('type' in meta && typeof meta.type !== 'string') {
            errors.push('Invalid type: must be a string');
        }

        return {
            isValid: errors.length === 0,
            errors,
            meta
        };
    }

    /**
     * Упрощённая проверка — возвращает только boolean.
     * @param {Object} meta - Метаданные файла.
     * @returns {boolean} true, если метаданные валидны.
     */
    static isValidFileMetadata(meta) {
        return this.validateFileMetadata(meta).isValid;
    }
}

module.exports = DataValidator;
