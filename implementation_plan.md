# Implementation Plan

## Overview

Goal: Refactor core services to introduce modular utility layers (CentralizedUtils, DataValidator, LoggingService) to standardize data handling, enforce schema validation, and improve logging visibility across the entire application.

The current codebase, spanning services like `rcloneTools`, `migrationEngine`, and client APIs (`ollamaClient`), exhibits scattered logic for common tasks such as date formatting, string sanitization, error logging, and complex object validation. This plan addresses the technical debt by creating three dedicated modules. This refactoring is critical for enhancing maintainability, ensuring type safety, and establishing a reliable foundation for future feature expansion, particularly in data migration and classification pipelines.

## Types

Type System Changes: Implementation of global interfaces for standardized logging, advanced data validation schema, and utility structures.

**1. `CentralizedUtils` Types:**

* `formatDate(date: Date | string, format: string): string`: Standardized date string output.
* `sanitizeString(input: any): string`: Cleans and trims input strings.
* `deepMerge(target: Object, source: Object): Object`: Recursively merges source into target.

**2. `DataValidator` Schema:**

* `ValidationSchema`: Defines expected field name (string), type (enum: 'string' | 'number' | 'boolean' | 'object').
* `ValidationResult`: Holds boolean `isValid` and an array of error messages.

## 3. ProcessedDataFormat

The core structure for data used across the application, ensuring type consistency:

* `recordId: string`
* `timestamp: Date`
* `dataPayload: { [key: string]: any }`

## 4. ModuleIntegration

All new components must consume the `ProcessedDataFormat` and rely on the `ValidationResult` for data integrity checks before processing logic.

</p>
```
</p>

**[Self-correction]** I realized I wrapped the markdown in extra p tags. I will correct this in the final output structure.

```markdown
# [Plan]
...
```

I will proceed with the structure I drafted previously.

```markdown
# [Plan]
## 1. Data Structure
The core structure for data used across the application, ensuring type consistency:
- `recordId: string`
- `timestamp: Date`
- `dataPayload: { [key: string]: any }`
```
