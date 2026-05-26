/**
 * src/utils/file-system.js
 *
 * Модуль утилит для работы с файловой системой и метаданными.
 * Используется для получения пакетных (batch) метаданных файлов.
 *
 * @module FileSystemUtils
 * @exports {object} getBatchFileMetadata - Получает пакетные метаданные, включая BSUID.
 * @exports {object} getFileMetadata - Получает метаданные одного файла.
 */

const { extractAndStandardizeBSUID } = require('./bsRegexParser');

/**
 * Определяет структуру метаданных файла.
 * @typedef {Object} FileMetadata
 * @property {string} relativePath - Относительный путь.
 * @property {string} modTime - Время модификации в формате YYYY-MM-DD.
 * @property {boolean} isDirectory - Является ли директорией.
 * @property {Buffer} rawBytes - Сырые данные файла (для передачи в AI).
 * @property {object | null} bsuid - Извлеченный BSUID-объект.
 */

/**
 * Симулирует получение метаданных для пакета файлов.
 * В реальной системе здесь будет вызов rclone/API для пакэтного получения метаданных.
 *
 * @param {string[]} fileList - Список относительных путей к файлам/папкам.
 * @returns {Promise<{metadata: FileMetadata[]}>} Массив полных метаданных.
 */
async function getBatchFileMetadata(fileList) {
    console.log(`[FileSystem] Получение метаданных для ${fileList.length} файлов...`);

    const metadataList = [];

    // === Имитация данных для тестирования ===
    for (const relativePath of fileList) {
        let isDir = relativePath.includes('folder/') || relativePath.includes('archive/');
        let rawBytes = Buffer.from(`--- RAW CONTENT FOR ${relativePath} ---`);
        let modTime = "2024-01-15";

        if (relativePath.includes("invoice")) {
            modTime = "2024-12-25";
        } else if (relativePath.includes("photo_001")) {
            modTime = "2023-05-20";
        } else if (relativePath.includes("report_general")) {
            modTime = "2022-11-01";
        }

        // Извлечение BSUID и проверка его наличия
        const bsuidMatch = await extractAndStandardizeBSUID(relativePath);
        let bsuidData = null;
        if (bsuidMatch.bsuid) {
            bsuidData = bsuidMatch.bsuid;
            console.log(`[FileSystem] Найден BSUID для ${relativePath}: ${bsuidData}`);
        } else {
            console.log(`[FileSystem] BSUID не найден для ${relativePath}.`);
        }

        // Моделирование записи метаданных
        const metadata = {
            relativePath: relativePath,
            modTime: modTime,
            isDirectory: isDir,
            rawBytes: rawBytes,
            bsuid: bsuidData
        };
        metadataList.push(metadata);
    }

    return { metadata: metadataList };
}

/**
 * Пример функции для получения метаданных одного файла (может использоваться в других частях системы).
 * @param {string} filePath - Путь к файлу.
 * @returns {Promise<FileMetadata>}
 */
async function getFileMetadata(filePath) {
    console.log(`[FileSystem] Получение метаданных для одиночного файла: ${filePath}`);
    // В реальной системе: await rcloneTools.getFileMetadata(filePath)
    // Здесь можно добавить логику для одного файла.

    const bsuidMatch = await extractAndStandardizeBSUID(filePath);
    let bsuidData = null;
    if (bsuidMatch.bsuid) {
        bsuidData = bsuidMatch.bsuid;
        console.log(`[FileSystem] Найден BSUID для ${filePath}: ${bsuidData}`);
    } else {
        console.log(`[FileSystem] BSUID не найден для ${filePath}.`);
    }

    return {
        relativePath: filePath,
        modTime: new Date().toISOString().slice(0, 10),
        isDirectory: false,
        rawBytes: Buffer.from(`--- RAW CONTENT FOR ${filePath} ---`),
        bsuid: bsuidData
    };
}

module.exports = {
    getBatchFileMetadata,
    getFileMetadata
};