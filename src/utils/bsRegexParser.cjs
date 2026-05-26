// src/utils/bsRegexParser.cjs

/**
 * @typedef {Object} BSRegisterEntry
 * @property {string} originalId - Оригинальный ID, найденный в системе.
 * @property {string} regionCode - Код региона (например, '12').
 * @property {string} uniqueNumber - Уникальный номер.
 * @property {string} standardId - Стандартизированный ID в формате BS-<КодРегиона>-<УникальныйНомер>.
 */

/**
 * Парсит старый идентификатор БС по регулярному выражению.
 *
 * @param {string} rawId - Сырая строка с ID.
 * @returns {BSRegisterEntry | null} Объект с унифицированными данными или null, если парсинг не удался.
 */
const parseBSID = (rawId) => {
    if (!rawId || typeof rawId !== 'string') {
        return null;
    }

    const regex = /(?:BS|BSR)?(?<region>\d{2})[-_]*[A-Z0-9]+(?<number>[A-Z0-9]+)/i;
    const match = rawId.match(regex);

    if (!match) {
        return null;
    }

    const region = match.groups?.region?.toUpperCase() || '??';
    const uniqueNumber = match.groups?.number?.toUpperCase() || '??';

    return {
        originalId: rawId,
        regionCode: region,
        uniqueNumber: uniqueNumber,
        standardId: `BS-${region}-${uniqueNumber}`
    };
};

/**
 * Получает список BSRegisterEntry из массива сырых ID.
 * @param {string[]} rawIds - Массив сырых ID.
 * @returns {BSRegisterEntry[]} Массив объектов BSRegisterEntry.
 */
const getBSRegisterEntries = (rawIds) => {
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return [];
    }
    return rawIds.map(id => parseBSID(id)).filter(entry => entry !== null);
};

/**
 * Извлекает и стандартизирует BSUID из имени файла/пути.
 * Используется модулем file-system.cjs.
 *
 * @param {string} relativePath - Относительный путь к файлу.
 * @returns {Promise<{bsuid: string|null}>} Объект с полем bsuid (стандартизированный ID или null).
 */
async function extractAndStandardizeBSUID(relativePath) {
    // Берём только имя файла без расширения для поиска ID
    const fileName = require('path').basename(relativePath, require('path').extname(relativePath));
    const entry = parseBSID(fileName);
    return {
        bsuid: entry ? entry.standardId : null
    };
}

module.exports = {
    parseBSID,
    getBSRegisterEntries,
    extractAndStandardizeBSUID
};