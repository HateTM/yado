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
 * Предполагаемая структура старого ID:
 * 1. Может содержать регион и ID в произвольном порядке, разделенные дефисами или другими символами.
 * 2. Наша цель - извлечь регион (2 цифры) и уникальный номер (буквы/цифры).
 *
 * @param {string} rawId - Сырая строка с ID.
 * @returns {BSRegisterEntry | null} Объект с унифицированными данными или null, если парсинг не удался.
 */
const parseBSID = (rawId) => {
    if (!rawId || typeof rawId !== 'string') {
        return null;
    }

    // Регулярное выражение для извлечения региона (XX) и номера (alphanumeric).
    // Это упрощенный пример, так как реальная логика должна быть более сложной.
    // Поиск двух цифр, которые, вероятно, являются кодом региона, и далее последовательности букв/цифр.
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
 * Получает список БSRegisterEntry из массива сырых ID.
 * @param {string[]} rawIds - Массив сырых ID.
 * @returns {BSRegisterEntry[]} Массив объектов BSRegisterEntry.
 */
const getBSRegisterEntries = (rawIds) => {
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return [];
    }
    return rawIds.map(id => parseBSID(id)).filter(entry => entry !== null);
};

module.exports = {
  parseBSID,
  getBSRegisterEntries
};
