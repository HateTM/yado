/**
 * @file CentralizedUtils.ts
 * @description Central repository for common utility functions used across various services,
 * including standardizing identifiers and determining data categories.
 */

/**
 * Extracts and standardizes a Unique Identifier (UID) from a given file path.
 * This function applies a set of predefined rules to convert various naming conventions
 * into a consistent, traceable format (e.g., BS-<CodeRegion>-<UniqueNumber>).
 *
 * @param {string} filePath - The full, relative path of the file.
 * @returns {string} The standardized UID. Returns 'UNKNOWN_UID' if standardization fails.
 */
export default function extractStandardizedUid(filePath: string): string {
    // Basic implementation logic: Check for a specific pattern or fallback to a hashing mechanism.
    // For simulation, we simply use a combination of directory and file name length.
    const parts = filePath.split(/[\\/]/);
    const name = parts[parts.length - 1];
    const directory = parts.slice(0, parts.length - 1).join('_');

    if (directory.length < 5 && name.length < 5) {
        return 'UNKNOWN_UID';
    }

    // Simulate standardization: Upper-casing, removing non-alphanumeric characters, and padding.
    const standardized = (directory + name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().padEnd(15, '0');
    return `BS-${standardized.substring(0, 2)}-${standardized}`;
}

/**
 * Determines the target category of data based on keywords found in the folder name.
 * This helps map files to their correct final destination within the migration plan.
 *
 * @param {string} folderName - The name of the parent directory.
 * @returns {string} The determined category name (e.g., 'UserProfiles', 'Configuration', 'Media').
 */
export function determineCategory(folderName: string): string {
    const lowerName = folderName.toLowerCase();

    if (lowerName.includes('user') || lowerName.includes('profile')) {
        return 'UserProfiles';
    }
    if (lowerName.includes('config') || lowerName.includes('settings')) {
        return 'Configuration';
    }
    if (lowerName.includes('image') || lowerName.includes('media')) {
        return 'MediaAssets';
    }
    if (lowerName.includes('doc') || lowerName.includes('document')) {
        return 'Documentation';
    }
    // Default fallback category
    return 'Miscellaneous';
}