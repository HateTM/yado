/**
 * @fileoverview Центральный оркестратор для процесса миграции файловой структуры.
 * Отвечает за:
 * 1. Получение метаданных файлов.
 * 2. Парсинг и стандартизация уникальных идентификаторов (UID).
 * 3. Определение целевой категории каталогов.
 * 4. Классификация файлов с помощью AI-сервиса.
 * 5. Агрегация данных в финальный план миграции.
 */

import fsUtil from '../utils/file-system';
import DetectionService from '../services/detection-service';
import { Logger } from '../utils/LoggingService';
import { DataValidator } from '../utils/DataValidator';
import { CentralizedUtils } from '../utils/CentralizedUtils';
// Предполагаемый модуль для работы с rclone (мокается в тестах)
import rcloneTools from '../rcloneTools';

/**
 * Класс-оркестратор, координирующий все этапы создания плана миграции.
 */
class MigrationEngine {
    /**
     * @param {Object} rcloneTools - Инструменты для работы с rclone.
     * @param {DetectionService} detectionService - Сервис для AI-классификации.
     */
    constructor(rcloneTools, detectionService) {
        this.rcloneTools = rcloneTools;
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
        LoggingService.debug(`[UID Extraction] Successfully processed UID for ${filePath}: ${standardizedUid}`);
        return standardizedUid;
    }

    /**
     * Определяет целевую категорию подкаталога по ключевым словам.
     * @param {string} folderName - Имя папки, содержащей данные.
     * @returns {string} Категория.
     */
    /**
     * Основная функция-фасад, которая координирует весь процесс.
     * @param {string[]} fileList - Список относительных путей к файлам, требующих обработки.
     * @returns {Promise<{plan: Object, reports: Object[]}>} Объект с финальным планом и отчетами.
     */
    async runPlan(fileList) {
        LoggingService.info("--- [MigrationEngine] Запуск цикла планирования миграции ---");

        // 1. Получение метаданных файлов
        const { metadata: fileMetadataList } = await fsUtil.getBatchFileMetadata(fileList);
        LoggingService.info(`[MigrationEngine] Успешно получено метаданных для ${ fileMetadataList.length } файлов.`);

        // 2. Инициализация структур данных
        const reports = [];
        const migrationPlan = [];

        // 3. Цикл обработки каждого файла
        for (const meta of fileMetadataList) {
            try {
                // Шаг 1: Парсинг UID
                const standardizedUid = this.extractAndStandardizeUid(meta.relativePath);

                // Шаг 2: Определение категории
                const folderNameParts = meta.relativePath.split(/[\\/]/);
                // Используем родительскую папку, чтобы определить категорию
                const category = this.determineCategory(folderNameParts.length > 1 ? folderNameParts[folderNameParts.length - 2] : folderNameParts[0]);

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
                LoggingService.error(`Ошибка при обработке файла ${ meta.relativePath }: `, error, { filePath: meta.relativePath });
                // Обработка ошибок, чтобы не прерывать весь процесс
            }
        }

        const finalPlan = {
            totalFilesProcessed: fileList.length,
            migrationPlan: migrationPlan,
            timestamp: new Date().toISOString(),
            sourceDirectory: fileList[0] ? fileList[0].substring(0, fileList[0].lastIndexOf('/')) : 'N/A'
        };
        LoggingService.info("--- [MigrationEngine] Планирование миграции завершено ---");

        return {
            plan: finalPlan,
            reports: reports
        };
    }
}

module.exports = MigrationEngine;
