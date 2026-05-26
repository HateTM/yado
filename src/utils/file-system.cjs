/**
 * @fileoverview Утилиты для работы с файловой системой.
 * Предоставляет методы для получения метаданных файлов.
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('./LoggingService.cjs');

/**
 * Преобразует относительные пути в полные относительно базовой директории.
 * @param {string[]} fileList - Список относительных путей.
 * @param {string} baseDir - Базовая директория для построения полных путей.
 * @returns {string[]} Список полных путей.
 */
function resolveFileListToAbsolute(fileList, baseDir) {
    return fileList.map(filePath => {
        // Нормализуем путь
        const normalizedPath = path.normalize(filePath);
        // Строим полный путь относительно baseDir
        return path.resolve(baseDir, normalizedPath);
    });
}

/**
 * Нормализует и проверяет путь к файлу.
 * @param {string} filePath - Исходный путь.
 * @returns {string|null} Нормализованный путь или null при ошибке.
 */
function normalizeAndValidatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return null;
    }

    const normalizedPath = path.normalize(filePath);
    return normalizedPath;
}

/**
 * Извлекает BSUID из пути файла.
 * @param {string} filePath - Путь к файлу.
 * @returns {string|null} Найденный BSUID или null.
 */
function extractBsuidFromPath(filePath) {
    const match = filePath.match(/BS-\d+-\d+/);
    return match ? match[0] : null;
}

/**
 * Получает метаданные одного файла.
 * @param {string} filePath - Полный путь к файлу.
 * @returns {Promise<Object|null>} Метаданные файла или null при ошибке.
 */
async function getFileMetadata(filePath) {
    try {
        const normalizedPath = normalizeAndValidatePath(filePath);
        if (!normalizedPath) {
            Logger.logWarn(`[FileSystem] Некорректный путь к файлу: ${filePath}`);
            return null;
        }

        // Проверка существования файла
        await fs.access(normalizedPath, fs.constants.F_OK);

        const stats = await fs.stat(normalizedPath);

        // Проверка, что это файл, а не директория
        if (!stats.isFile()) {
            Logger.logWarn(`[FileSystem] Путь указывает на директорию, а не файл: ${normalizedPath}`);
            return null;
        }

        const bsuid = extractBsuidFromPath(normalizedPath);

        return {
            path: normalizedPath,
            relativePath: path.relative(process.cwd(), normalizedPath),
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            bsuid: bsuid,
            extension: path.extname(normalizedPath).toLowerCase().substring(1) // Убираем точку
        };
    } catch (error) {
        Logger.logWarn(`[FileSystem] Ошибка получения метаданных для ${filePath}: ${error.message}`, {
            filePath,
            errorType: error.name,
            errorMessage: error.message,
            stack: error.stack
        });
        return null;
    }
}

/**
 * Получает метаданные для списка файлов с ограничением параллелизма.
 * @param {string[]} fileList - Список путей к файлам.
 * @param {number} [concurrencyLimit=10] - Максимальное количество параллельных операций.
 * @returns {Promise<{metadata: Object[], errors: Object[]}>} Объект с метаданными и ошибками.
 */
async function getBatchFileMetadata(fileList, concurrencyLimit = 10) {
    const validMetadata = [];
    const errors = [];

    // Преобразуем относительные пути в полные
    const absoluteFileList = resolveFileListToAbsolute(fileList, process.cwd());

    // Предварительная обработка списка файлов
    const processedFiles = new Set();
    const filteredFiles = [];

    for (const filePath of absoluteFileList) {
        const normalized = normalizeAndValidatePath(filePath);
        if (normalized && !processedFiles.has(normalized)) {
            processedFiles.add(normalized);
            filteredFiles.push(normalized);
        } else if (!normalized) {
            errors.push({ filePath, error: 'Invalid file path format' });
            Logger.logWarn(`[FileSystem] Пропущен файл с некорректным форматом пути: ${filePath}`);
        } else {
            Logger.logDebug(`[FileSystem] Обнаружен дубликат пути: ${normalized}`);
        }
    }

    Logger.logInfo(`[FileSystem] Обрабатывается ${filteredFiles.length} уникальных файлов (изначально: ${fileList.length})`);

    // Обработка файлов с ограничением параллелизма
    for (let i = 0; i < filteredFiles.length; i += concurrencyLimit) {
        const batch = filteredFiles.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(async (filePath) => {
            const metadata = await getFileMetadata(filePath);
            if (metadata) {
                validMetadata.push(metadata);
                if (!metadata.bsuid) {
                    Logger.logDebug(`[FileSystem] BSUID не найден для ${filePath}`);
                } else {
                    Logger.logInfo(`[FileSystem] Найден BSUID для ${filePath}: ${metadata.bsuid}`);
                }
            } else {
                const errorObj = { filePath, error: 'Failed to retrieve metadata' };
                errors.push(errorObj);
                Logger.logWarn(`[FileSystem] Не удалось получить метаданные для ${filePath}`, errorObj);
            }
        });

        await Promise.all(batchPromises);
    }

    Logger.logInfo(`[FileSystem] Получены метаданные для ${validMetadata.length} файлов. Ошибок: ${errors.length}`);
    return {
        metadata: validMetadata,
        errors: errors
    };
}


module.exports = {
    getFileMetadata,
    getBatchFileMetadata
};
