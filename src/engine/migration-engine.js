/**
 * src/engine/migration-engine.js
 *
 * Ядро системы миграции метаданных Баз Станций (БС).
 * Отвечает за оркестрацию процесса: парсинг ID -> Классификация (LLM) -> Генерация отчета.
 * Является главным источником бизнес-логики для миграции метаданных.
 *
 * ВНИМАНИЕ: Все внешние зависимости (parsing, classification) должны быть импортированы.
 *
 * @module MigrationEngine
 */

// Импорты
const fs = require('fs').promises;
const path = require('path');
const { getBSRegisterEntries } = require('../utils/bsRegexParser');

/**
 * Извлекает и стандартизирует BSUID из полного пути к файлу.
 * @param {string} fullPath - Полный путь к файлу.
 * @returns {Promise<{originalId: string, regionCode: string, uniqueNumber: string, standardId: string} | null>}
 */
async function extractAndStandardizeBSUID(fullPath) {
    // Используем полный путь как единственный сырой ID
    const entries = getBSRegisterEntries([fullPath]);
    // Возвращаем первый найденный и стандартизированный ID, если он есть.
    return entries.length > 0 ? entries[0] : null;
}
const { classifyFileWithOllama } = require('../api/ollamaClient');

/**
 * @typedef {object} FileMetadata
 * @property {string} fullPath - Полный путь к файлу.
 * @property {string} extension - Расширение файла.
 * @property {string} contentSummary - Краткое описание содержимого файла (от контекста).
 * @property {Date} modTime - Время последней модификации файла.
 * @property {string} [sourceBsId] - Стандартизированный ID, полученный из пути.
 */

/**
 * @typedef {object} MigrationFile
 * @property {FileMetadata} metadata - Исходные метаданные.
 * @property {object} classification - Результаты классификации от LLM.
 * @property {string} finalCategory - Финальная категория миграции (e.g., "01").
 * @property {string} suggestedNewName - Предлагаемое новое имя файла.
 */

/**
 * @typedef {object} MigrationReport
 * @property {string} timestamp - Время генерации отчета.
 * @property {number} fileCount - Количество обработанных файлов.
 * @property {Array<MigrationFile>} files - Массив объектов с деталями миграции.
 */


/**
 * Инициализирует и запускает полный цикл миграционной отчетности.
 * @param {string} sourceDirectory - Директория с метаданными для обработки.
 * @returns {Promise<MigrationReport>} Финальный отчет миграции.
 */
async function generateMigrationPlan(sourceDirectory) {
    console.log(`\n=============================================================`);
    console.log(`[Engine] Starting migration plan generation from: ${sourceDirectory}`);
    console.log(`===========================================================\n`);

    const fileList = await getFileMetadataList(sourceDirectory);
    if (fileList.length === 0) {
        throw new Error("Не обнаружено метаданных файлов для обработки.");
    }

    /** @type {Array<MigrationFile>} */
    const migrationFiles = [];

    for (const metadata of fileList) {
        try {
            console.log(`\n--- Processing file: ${path.basename(metadata.fullPath)} ---`);

            // 1. ПАРСИНГ ИДЕНТИФИКАТОРА (BSUID)
            const sourceBsId = await extractAndStandardizeBSUID(metadata.fullPath);
            
            /** @type {MigrationFile} */
            const migrationFile = {
                metadata: metadata,
                sourceBsId: sourceBsId,
                classification: null,
                finalCategory: '02', // Default
                suggestedNewName: 'UNKNOWN',
            };

            // 2. КЛАССИФИКАЦИЯ (LLM)
            if (sourceBsId) {
                try {
                    const classification = await classifyFileWithOllama(metadata);
                    migrationFile.classification = classification;
                    migrationFile.finalCategory = classification.finalCategory;
                    migrationFile.suggestedNewName = classification.suggestedNewName;
                } catch (error) {
                    console.error(`[ERROR] Failed to classify ${path.basename(metadata.fullPath)}:`, error.message);
                    migrationFile.classification = { error: error.message };
                    migrationFile.finalCategory = '99'; // Error category
                    migrationFile.suggestedNewName = `${metadata.modTime}_Error_ClassificationFailed_${metadata.extension}`;
                }
            } else {
                console.warn(`[WARN] Skipping classification for ${path.basename(metadata.fullPath)}: BSUID не найден или некорректен.`);
            }
            
            migrationFiles.push(migrationFile);

        } catch (error) {
            console.error(`[CRITICAL ERROR] Failed to process ${path.basename(metadata.fullPath)}:`, error.message);
        }
    }

    // 3. СБОР ОТЧЕТА
    const report = {
        timestamp: new Date().toISOString(),
        fileCount: fileList.length,
        files: migrationFiles
    };

    console.log(`\n===============================================================`);
    console.log(`[Engine] Plan generation complete. Processed ${fileList.length} files.`);
    console.log(`===========================================================\n`);
    
    return report;
}


/**
 * Сбор базовой метаинформации для всех файлов в заданной директории.
 * @param {string} dirPath - Путь к директории.
 * @returns {Promise<Array<FileMetadata>>} Список метаданных.
 */
async function getFileMetadataList(dirPath) {
    console.log(`[Metadata] Scanning directory for files: ${dirPath}`);
    const files = [];
    
    // Эмуляция получения списка файлов (в реальной системе здесь использовался бы fs.readdir и fs.stat)
    // Для целей этого модуля, мы используем жестко закодированный список для симуляции работы.
    const simulatedFiles = [
        { fullPath: path.join(dirPath, 'module_A_BS-111-12345_report.docx'), extension: 'docx', contentSummary: 'Содержит отчет о продажах за период', modTime: new Date('2026-05-25T08:00:00Z') },
        { fullPath: path.join(dirPath, 'module_B_BS-222-98765_schema.pdf'), extension: 'pdf', contentSummary: 'Детальная схема подключения оборудования', modTime: new Date('2026-05-24T12:00:00Z') },
        { fullPath: path.join(dirPath, 'module_C_standalone_file.txt'), extension: 'txt', contentSummary: 'Простой лог данных, без ID', modTime: new Date('2026-05-23T09:00:00Z') },
        { fullPath: path.join(dirPath, 'module_D_BS-111-55555_notes.md'), extension: 'md', contentSummary: 'Примечания к работе станции.', modTime: new Date('2026-05-25T07:30:00Z') }
    ];
    
    for (const file of simulatedFiles) {
        // Добавляем sourceBsId, если он явно указан для симуляции, иначе остается null
        const sourceBsId = file.fullPath.includes('BS-111-12345') ? { uid: 'BS-111-12345', regionCode: '111', uniqueNumber: '12345' } : null;

        files.push({
            fullPath: file.fullPath,
            extension: file.extension,
            contentSummary: file.contentSummary,
            modTime: file.modTime,
            sourceBsId: sourceBsId
        });
    }
    
    return files;
}

/**
 * Сохраняет финальный отчет в JSON файл.
 * @param {MigrationReport} report - Объект отчета.
 * @param {string} outputPath - Путь для сохранения файла.
 */
async function saveMigrationReport(report, outputPath) {
    const jsonContent = JSON.stringify(report, null, 2);
    await fs.writeFile(outputPath, jsonContent);
    console.log(`\n[SUCCESS] Migration Plan Report saved to: ${outputPath}`);
}

/**
 * Экспорт публичных методов
 */
module.exports = {
    generateMigrationPlan,
    saveMigrationReport,
    extractAndStandardizeBSUID
};