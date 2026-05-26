/**
 * @file DataValidator.ts
 * @description Dedicated module for handling data schema validation, ensuring data integrity
 * before processing core records in the application.
 */

/**
 * Represents the expected schema for validation.
 * @typedef {object} ValidationSchema
 * @property {string[]} [requiredFields] - List of fields that must be present.
 * @property {object.<string, 'string' | 'number' | 'boolean'>} [typeChecks] - Map of field names to expected JavaScript types.
 */

/**
 * Validates if a data structure adheres to a required schema.
 * @param {object} data - The data object to validate.
 * @param {ValidationSchema} schema - The schema definition (e.g., { requiredFields: ['id', 'name'], typeChecks: { id: 'string' } }).
 * @returns {{isValid: boolean, message: string}} Validation result.
 */
export function validateData(data: { [x: string]: any; }, schema: { requiredFields: any; typeChecks: { [x: string]: any; }; }) {
    if (!schema) {
        return { isValid: true, message: "No schema provided, assuming valid." };
    }

    // 1. Check for required fields
    if (schema.requiredFields && Array.isArray(schema.requiredFields)) {
        for (const field of schema.requiredFields) {
            if (data[field] === undefined || data[field] === null) {
                return { isValid: false, message: `Missing required field: ${field}` };
            }
        }
    }

    // 2. Check data types
    if (schema.typeChecks && typeof schema.typeChecks === 'object') {
        for (const field in schema.typeChecks) {
            const expectedType = schema.typeChecks[field];
            const actualValue = data[field];

            if (typeof actualValue !== expectedType) {
                return { isValid: false, message: `Field '${field}' must be of type ${expectedType}, but received ${typeof actualValue}` };
            }
        }
    }

    return { isValid: true, message: "Data validation successful." };
}