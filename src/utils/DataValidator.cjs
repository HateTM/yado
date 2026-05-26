/**
 * @fileoverview Utility for standardizing schema validation and data type checking.
 * Ensures data integrity before processing core business logic.
 * @module DataValidator
 */

/**
 * Validates if a value is a non-empty string.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a non-empty string, false otherwise.
 */
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates if a value is a number, excluding NaN and non-finite numbers.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a finite number, false otherwise.
 */
function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
}

/**
 * Validates if a value is an array.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is an array, false otherwise.
 */
function isArray(value) {
    return Array.isArray(value);
}

/**
 * Performs a deep validation of a record against a defined schema.
 * This function is a placeholder for more complex schema validation logic (e.g., using Joi or Zod).
 * @param {object} record - The data record to validate.
 * @param {object} schema - The schema definition: { fieldName: { type: 'string'|'number'|'array', required: boolean } }
 * @returns {{isValid: boolean, errors: string[]}} An object containing validation status and list of errors.
 */
function validateRecord(record, schema) {
    const errors = [];
    let isValid = true;

    if (typeof record !== 'object' || record === null) {
        errors.push('Record must be a non-null object.');
        return { isValid: false, errors };
    }

    for (const fieldName in schema) {
        if (Object.hasOwnProperty.call(schema, fieldName)) {
            const fieldSchema = schema[fieldName];
            const value = record[fieldName];
            const required = fieldSchema.required !== false; // Default to required

            // Check for required field
            if (required && (typeof value === 'undefined' || value === null || (typeof value === 'string' && value.trim() === ''))) {
                errors.push(`Missing or empty required field: ${fieldName}.`);
                isValid = false;
                continue;
            }

            // Check type validation if value exists
            if (value !== undefined && value !== null) {
                let typeError = false;
                switch (fieldSchema.type) {
                    case 'string':
                        if (typeof value !== 'string') {
                            typeError = true;
                        }
                        break;
                    case 'number':
                        if (typeof value !== 'number' || !isFiniteNumber(value)) {
                            typeError = true;
                        }
                        break;
                    case 'array':
                        if (!isArray(value)) {
                            typeError = true;
                        }
                        break;
                    default:
                    // No specific type check defined
                }

                if (typeError) {
                    errors.push(`Field '${fieldName}' must be of type '${fieldSchema.type}'. Found: ${typeof value}.`);
                    isValid = false;
                }
            }
        }
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Schema example for migration records.
 * @type {object}
 */
const MIGRATION_SCHEMA = {
    recordId: { type: 'string', required: true },
    sourceSystem: { type: 'string', required: true },
    timestamp: { type: 'number', required: true },
    dataPayload: { type: 'object', required: false }
};

module.exports = {
    isNonEmptyString,
    isFiniteNumber,
    isArray,
    validateRecord,
    MIGRATION_SCHEMA
};
