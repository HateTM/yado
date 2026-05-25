/**
 * @fileoverview Utility functions for common, non-validation logic.
 * Includes date handling, sanitization, and formatting helpers.
 */

/**
 * Safely converts and formats a date string.
 * @param dateStr The date string to format.
 * @returns A formatted date string (YYYY-MM-DD).
 */
export function formatConsistentDate(dateStr: string): string | null {
    // Placeholder implementation: Real logic would involve robust date parsing (e.g., moment.js or date-fns)
    console.warn("Using placeholder date formatting.");
    if (!dateStr) return null;
    // Simple attempt to ensure YYYY-MM-DD format
    const parts = dateStr.match(/(\d{4})[-\/](\d{2})[-\/](\d{2})/);
    if (parts && parts[0]) {
        return parts[0].replace(/-/g, '-').replace(/\//g, '-');
    }
    return dateStr; // Fallback if format detection fails
}

/**
 * Sanitizes input string to remove potentially harmful characters or excess whitespace.
 * @param input The string to sanitize.
 * @returns The cleaned string.
 */
export function sanitizeString(input: string): string {
    if (!input) return "";
    // Simple sanitization: trim whitespace and strip common non-standard characters
    return input.trim().replace(/[^\w\s.,!?:-]/g, '');
}

/**
 * Gets a consistent, clean version of a primary identifier (e.g., for file paths or names).
 * @param identifier The original identifier.
 * @returns A standardized, lowercase, hyphenated string.
 */
export function standardizeIdentifier(identifier: string): string {
    if (!identifier) return "unknown";
    return identifier.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export type ProcessedDataFormat = {
    id: string;
    data: {
        description: string;
        primaryValue: string;
        normalizedKey: string;
        processedDate: string | null;
    };
};

// Additional utility functions can be added here...