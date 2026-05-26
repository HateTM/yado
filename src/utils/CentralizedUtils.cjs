/**
 * @fileoverview Collection of centralized, reusable utility functions.
 * Contains common logic for tasks like date handling, sanitization, and formatting.
 * This module standardizes these tasks across the application.
 * @module CentralizedUtils
 */

/**
 * Formats a Date object into a standardized ISO string format.
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted date string (e.g., YYYY-MM-DDTHH:mm:ss.sssZ).
 * @throws {Error} If the provided date is invalid.
 */
function formatTimestamp(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        throw new Error("Invalid Date object provided to formatTimestamp.");
    }
    return date.toISOString();
}

/**
 * Calculates the difference between two dates in days.
 * @param {Date} date1 - The first date.
 * @param {Date} date2 - The second date.
 * @returns {number} The difference in days.
 * @throws {Error} If either date is invalid.
 */
function dateDifferenceInDays(date1, date2) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / MS_PER_DAY);
}

/**
 * Sanitizes a string by stripping out HTML tags and potentially malicious scripts.
 * Useful for cleaning user input or scraped data.
 * @param {string} inputString - The string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitizeString(inputString) {
    if (typeof inputString !== 'string') {
        return '';
    }
    // Basic sanitization: strip HTML tags and trim whitespace
    return inputString.replace(/<[^>]*>?/gm, '').trim();
}

/**
 * Attempts to parse a Unix timestamp (milliseconds or seconds) into a Date object.
 * @param {number} timestamp - The timestamp value.
 * @param {string} [unit='ms'] - The unit of the timestamp ('ms' for milliseconds, 's' for seconds).
 * @returns {Date} A Date object representing the timestamp.
 * @throws {Error} If the timestamp is invalid.
 */
function parseTimestamp(timestamp, unit = 'ms') {
    let ms;
    if (typeof timestamp !== 'number' || !isFinite(timestamp)) {
        throw new Error("Invalid timestamp provided to parseTimestamp.");
    }

    if (unit === 's') {
        ms = timestamp * 1000;
    } else if (unit === 'ms') {
        ms = timestamp;
    } else {
        throw new Error("Unsupported timestamp unit. Use 'ms' or 's'.");
    }

    const date = new Date(ms);
    if (isNaN(date.getTime())) {
        throw new Error(`Timestamp ${timestamp} (${unit}) resulted in an invalid date.`);
    }
    return date;
}

/**
 * Extracts and standardizes a Unique Identifier (UID) from a given file path.
 * Attempts to convert various path structures into a consistent format (e.g., BS-REGION-NUMBER).
 * This is a simplified heuristic implementation based on common project structures.
 * @param {string} filePath - The full path to the file.
 * @returns {string} The standardized UID (or 'UNKNOWN_UID' if no pattern matches).
 */
function extractStandardizedUid(filePath) {
    // Basic sanitation for consistent matching
    const cleanPath = filePath.replace(/[\\/]/g, '/');

    // Regex 1: Attempts to match a pattern like /project-name/version/file.js
    const projectVersionMatch = cleanPath.match(/\/([a-zA-Z0-9-]+)\/v?([0-9.-]+)/);
    if (projectVersionMatch && projectVersionMatch[1] && projectVersionMatch[2]) {
        // Heuristic: Use the project name and version
        return `BS-${projectVersionMatch[1].toUpperCase()}-${projectVersionMatch[2].toUpperCase().replace(/\./g, '-')}`;
    }

    // Regex 2: Attempts to match patterns based on root directories (e.g., /src/utils/...)
    const rootMatch = cleanPath.match(/^(src|libs|components|utils)/);
    if (rootMatch && rootMatch[1]) {
        // Heuristic: Use the root directory name as the primary segment
        return `BS-${rootMatch[1].toUpperCase()}-ROOT`;
    }

    // Fallback: Use a simple hash or a default unknown UID
    return `UNKNOWN_UID`;
}


module.exports = {
    formatTimestamp,
    dateDifferenceInDays,
    sanitizeString,
    parseTimestamp,
    extractStandardizedUid
};