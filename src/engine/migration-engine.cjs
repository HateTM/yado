/**
 * @fileoverview Центральный оркестратор для процесса миграции файловой структуры.
 * Отвечает за:
 * 1. Получение метаданных файлов.
 * 2. Парсинг и стандартизация уникальных идентификаторов (UID).
 * 3. Определение целевой категории каталогов.
 * 4. Классификация файлов с помощью AI-сервиса.
 * 5. Агрегация данных в финальный план миграции.
 */

const fsUtil = require('../utils/file-system.cjs');
const DetectionService = require('../services/detection-service.cjs');
const Logger = require('../utils/LoggingService.cjs');
const DataValidator = require('../utils/DataValidator.cjs');
const CentralizedUtils = require('../utils/CentralizedUtils.cjs');
// rcloneTools импортируем в конструктор, чтобы избежать циклических зависимостей
const rcloneTools = require('../../rcloneTools.cjs');

/**
 * Класс-оркестратор, координирующий все этапы создания плана миграции.
 */
class MigrationEngine {
    /**
     * @param {Object} rcloneTools - Инструменты для работы с rclone.
     * @param {DetectionService} detectionService - Сервис для AI-классификации.
     */
    constructor(rcloneTools, detectionService) {
        // Инициализация инструментов для работы с rclone
        this.rcloneTools = rcloneTools;
        // Инициализация сервиса AI-классификации
        this.detectionService = detectionService;
    }
    /**
     * Парсинг и приведение старых форматов ID к стандарту BS-<КодРегиона>-<УникальныйНомер>.
    * @param {string} filePath - Полный путь к файлу (включает информацию о структуре).
    * @returns {string} Стандартизированный UID или UNKNOWN_UID.
     */
    extractAndStandardizeUid(filePath) {
        // Используем CentralizedUtils для извлечения и стандартизации UID
        const standardizedUid = CentralizedUtils.extractStandardizedUid(filePath);
        Logger.debug(`[UID Extraction] Successfully processed UID for ${filePath}: ${standardizedUid}`);
        return standardizedUid;
    }

    /**
     * Определяет целевую категорию подкаталога, используя метаданные файла.
     * @param {Object} meta - Метаданные файла, содержащие path и relativePath.
     * @returns {Promise<string>} Категория (e.g., 'API', 'UTILITIES', 'CORE').
     */
    async determineCategory(meta) {
        const relativePath = meta.relativePath;

        // 1. Проверка по известным маркерам
        const lowerPath = relativePath.toLowerCase();
        if (lowerPath.includes('rclone') || lowerPath.includes('rclone-cli-wrapper')) {
            return 'INFRASTRUCTURE';
        }
        if (lowerPath.includes('test') || lowerPath.includes('__tests__')) {
            return 'TESTING';
        }
        if (lowerPath.includes('utils/centralizedutils')) {
            return 'UTILITIES';
        }
        if (lowerPath.includes('service/detection-service')) {
            return 'CORE_SERVICE';
        }

        // 2. Имитация сложной LLM-классификации
        // В реальной системе здесь будет сложный вызов AI для анализа контекста.
        // Используем расширяемую логику, основанную на path.
        if (lowerPath.includes('api') || lowerPath.includes('proto/')) {
            return 'API';
        }
        if (lowerPath.includes('engine/') || lowerPath.includes('migration-engine')) {
            return 'ENGINEERING_CORE';
        }
        if (lowerPath.includes('task') || lowerPath.includes('project')) {
            return 'CORE_FUNCTIONALITY';
        }
        
        // Fallback
        return 'GENERAL';
    }
    
    /**
     * Основная функция-фасад, которая координирует весь процесс.
     * @param {string[]} fileList - Список относительных путей к файлам, требующих обработки.
     * @returns {Promise<{plan: Object, reports: Object[]}>} Объект с финальным планом и отчетами.
     */
    async runPlan(fileList) {
        Logger.info("--- [MigrationEngine] Запуск цикла планирования миграции ---");

        // 1. Получение метаданных файлов
        const { metadata: fileMetadataList } = await fsUtil.getBatchFileMetadata(fileList);
        Logger.info(`[MigrationEngine] Успешно получено метаданных для ${ fileMetadataList.length } файлов.`);

        // 2. Инициализация структур данных
        const reports = [];
        const migrationPlan = [];

        // 3. Цикл обработки каждого файла
        for (const meta of fileMetadataList) {
            try {
                // Шаг 1: Парсинг UID
                const standardizedUid = this.extractAndStandardizeUid(meta.relativePath);

                // Шаг 2: Определение категории с помощью метаданных и AI-логики
                const category = await this.determineCategory(meta);

                // Шаг 3: Классификация (AI)
                const detectionReport = await this.detectionService.analyzeFile(meta);

                // 4. Сбор данных в план
                const planEntry = {
                    source: meta.relativePath,
                    standardizedUid: standardizedUid,
                    targetCategory: category,
                    detection: detectionReport
                };
                migrationPlan.push(planEntry);
                reports.push(detectionReport);

            } catch (error) {
                Logger.error(`Ошибка при обработке файла ${ meta.relativePath }: `, error, { filePath: meta.relativePath });
                // Обработка ошибок, чтобы не прерывать весь процесс
            }
        }

        const finalPlan = {
            totalFilesProcessed: fileList.length,
            migrationPlan: migrationPlan,
            timestamp: new Date().toISOString(),
            sourceDirectory: fileList[0] ? fileList[0].substring(0, fileList[0].lastIndexOf('/')) : 'N/A'
        };
        Logger.info("--- [MigrationEngine] Планирование миграции завершено ---");

        // 5. Исполнение миграции и возврат финальных отчетов
        const migrationReport = await this.executeMigration(finalPlan);
        Logger.info("--- [MigrationEngine] Исполнение миграции завершено ---");
        
        return {
            plan: finalPlan,
            reports: reports,
            migrationReport: migrationReport
        };
    }

    /**
     * @private
     * Имитирует процесс фактической миграции данных и файловой структуры на основе плана.
     * В продакшен-версии здесь должен быть сложный, транзакционный код,
     * который взаимодействует с целевой системой (e.g., GraphQL, отдельный API).
     * @param {Object} finalPlan - Финальный план, сгенерированный runPlan.
     * @returns {Promise<{status: 'SUCCESS'|'FAILURE', message: string}>} Отчет о ходе миграции.
     */
    async executeMigration(finalPlan) {
        Logger.info("--- [MigrationEngine] Запуск этапа фактической миграции ---");

        if (!finalPlan || !finalPlan.migrationPlan || finalPlan.migrationPlan.length === 0) {
            Logger.warn("[MigrationEngine] Миграция отменена: Нет данных в плане.");
            return { status: 'FAILURE', message: 'No migration plan generated.' };
        }

        // --- СИМУЛЯЦИЯ МИГРАЦИИ ---
        let successCount = 0;
        let failCount = 0;
        const failures = [];

        for (const planEntry of finalPlan.migrationPlan) {
            try {
                // Проверка целевой категории и UID перед "выгрузкой"
                if (!planEntry.standardizedUid || !planEntry.targetCategory) {
                    throw new Error("Missing UID or Target Category in plan entry.");
                }

                // 1. Логика транзакции: имитация записи данных в целевую систему
                Logger.debug(`[MigrationEngine] Мигрируем ${planEntry.source} -> ${planEntry.targetCategory} (UID: ${planEntry.standardizedUid})`);
                
                // В реальном коде здесь будет await rcloneTools.uploadToTargetSystem(...)
                // или await this.detectionService.commitMigration(planEntry.detection);

                successCount++;

            } catch (error) {
                Logger.error(`Ошибка при миграции файла ${planEntry.source}: `, error.message);
                failures.push({ source: planEntry.source, error: error.message });
                failCount++;
            }
        }
        
        const migrationReport = {
            status: failCount > 0 ? 'PARTIAL_FAILURE' : 'SUCCESS',
            totalFilesAttempted: finalPlan.totalFilesProcessed,
            successfulMigrations: successCount,
            failedMigrations: failCount,
            detailedFailures: failures
        };

        Logger.info(`--- [MigrationEngine] Миграция завершена. Успешно: ${successCount}, Ошибок: ${failCount} ---`);
        
        return migrationReport;
    }
}

module.exports = MigrationEngine;
