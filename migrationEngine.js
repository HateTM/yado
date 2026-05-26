/**
 * migrationEngine.js
 * 
 * Класс-движок для обработки каталогов, парсинга идентификаторов БС,
 * определения целевых структур и генерации плана миграции с использованием RRL-операций.
 * 
 * @module migrationEngine
 */

const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');

const { RcloneManager } = require('./rcloneTools.cjs');

/**
 * Карта регулярных выражений для извлечения старых форматов ID.
 * Ключ: описательный комментарий. Значение: RegExp.
 */
const BS_ID_REGEX_MAP = {
    // Формат: 'BS 37-2971_...' или 'BS-37-2971'
    format_1: /BS\s*[\-]?(\d{2})-(\d{4,5})_.*|BS-?(\d{2})-(\d{4,5})/,
    // Формат: '49986-P-76-...'
    format_2: /(\d{5}-\w{1}-\d{2,3})/,
    // Формат: '28586_ИВ_...'
    format_3: /(\d{5}_\w{2}_\w{1})/,
    // Формат: 'бс -19075'
    format_4: /бс\s*[-\s](\d{4,5})/,
};

/**
 * Карта ключевых слов для определения категории подкаталога.
 * Приоритет: 01 -> 02 -> 03 -> 05 -> 08
 */
const CATEGORY_KEYWORDS = {
    "01_survey_pir": ['ПИР', 'Обследование'],
    "02_design": ['Проектирование', 'КМ', 'РНС'],
    "03_construction": ['Стройка', 'Монтаж', 'Исполнительная документация'],
    "05_maintenance_to": ['ТО', 'Техническое обслуживание', 'Замеры'],
    "08_archive": []
};

/**
 * Главная класс миграционного движка.
 */
class MigrationEngine {
    /**
     * @param {RcloneManager} rcloneManager - Экземпляр RcloneManager.
     * @param {string} reportsDir - Путь к директории отчетов (по умолчанию "reports").
     */
    constructor(rcloneManager, reportsDir = "reports") {
        this.rclone = rcloneManager;
        this.reportsDir = reportsDir;
        this.bsRegister = new Map();
    }

    /**
     * Пытается извлечь стандартизированный UID из предоставленного пути/имени.
     * @param {string} filePath - Старый полный путь или имя файла.
     * @returns {string | null} Стандартизированный UID в формате BS-<КодРегиона>-<УникальныйНомер> или null.
     */
    extractAndStandardizeUid(filePath) {
        let rawIdMatch = null;
        let formatKey = null;
        let uniqueNumber = null;

        // Поиск ID по всем известным регуляркам
        for (const key in BS_ID_REGEX_MAP) {
            const regex = BS_ID_REGEX_MAP[key];
            const match = filePath.match(regex);
            if (match) {
                rawIdMatch = match[0];
                formatKey = key;
                // Логика извлечения номера зависит от формата
                if (key === 'format_1' && match[2]) {
                    uniqueNumber = `${match[2]}`;
                } else if (key === 'format_2' && match[1]) {
                    uniqueNumber = match[1].replace(/[^0-9]/g, '');
                } else if (key === 'format_3' && match[1]) {
                    uniqueNumber = match[1].replace(/[^0-9]/g, '');
                } else if (key === 'format_4' && match[1]) {
                    uniqueNumber = match[1];
                }
                break;
            }
        }

        if (rawIdMatch && uniqueNumber) {
            // Упрощенная логика генерации UID.
            let regionCode = '00';
            if (rawIdMatch.includes('37')) regionCode = '37';
            else if (rawIdMatch.includes('49')) regionCode = '49';
            else if (rawIdMatch.includes('28')) regionCode = '28';

            return `BS-${regionCode}-${uniqueNumber}`;
        }
        return null;
    }

    /**
     * Классифицирует категорию папки по ключевым словам.
     * @param {string} folderName - Имя папки.
     * @returns {string} Стандартизированный код категории (01, 02, 03, 05, 08).
     */
    determineCategory(folderName) {
        const normalizedName = folderName.trim();
        for (const categoryCode in CATEGORY_KEYWORDS) {
            const keywords = CATEGORY_KEYWORDS[categoryCode];
            if (keywords.some(keyword => normalizedName.includes(keyword))) {
                return categoryCode;
            }
        }
        return '08_archive';
    }

    /**
     * Обрабатывает список файлов и строит реестр UID и сырой план миграции.
     * @param {Array<{path: string, modTime: string, fullPath: string}>} fileList - Массив объектов файлов.
     * @returns {{registration: Object, plan: Array<Object>}} Объект с реестром UID и планом миграции.
     */
    async processFilelistForPlan(fileList) {
        const bsRegistry = new Map();
        
        // 1. Построение Реестра БС
        for (const item of fileList) {
            const uid = this.extractAndStandardizeUid(item.fullPath);
            if (uid) {
                if (!bsRegistry.has(uid)) {
                    bsRegistry.set(uid, {
                        old_paths: [],
                        first_found: item.modTime
                    });
                }
                bsRegistry.get(uid).old_paths.push(item.fullPath);
            }
        }

        const bsRegistryObject = {};
        bsRegistry.forEach((data, uid) => {
            bsRegistryObject[uid] = {
                old_paths: data.old_paths,
                first_found: data.first_found
            };
        });

        // 2. Построение сырого Плана Миграции
        const rawMigrationPlan = [];

        for (const item of fileList) {
            const uid = this.extractAndStandardizeUid(item.fullPath);
            const category = this.determineCategory(item.path.split('/').pop() || item.path);

            if (uid) {
                const datePart = item.modTime.substring(0, 10).replace(/-/g, '-');
                const fileNameTemplate = `${datePart}_${uid}_${category}_v1.${item.path.split('.').pop()}`;

                rawMigrationPlan.push({
                    sourcePath: item.fullPath,
                    targetStructure: `Base_Stations/REGION_${uid.split('-')[1]}/${uid}_${category}/`,
                    newFileName: fileNameTemplate,
                    fullNewTargetPath: `${targetStructure}${fileNameTemplate}`
                });
            }
        }

        return {
            registration: bsRegistryObject,
            rawPlan: rawMigrationPlan
        };
    }

    /**
     * Генерирует финальный план миграции.
     * @param {{registration: Object, rawPlan: Array<Object>}} processedData - Данные обработки.
     * @returns {{metadata: Object, files: Array<Object>}} Финальный план миграции.
     */
    assembleMigrationPlan(processedData) {
        const { registration, rawPlan } = processedData;

        return {
            metadata: {
                run_date: new Date().toISOString()
            },
            files: rawPlan
        };
    }

    /**
     * Выполняет полную миграцию: парсинг, определение целевой структуры, копирование с синхронизацией.
     * @param {string[]} oldPaths - Список старых путей для миграции.
     * @returns {Promise<{success: boolean, planPath: string | null, migrationPlan: Object, error: string | null}>} Результат миграции.
     */
    async executeFullMigration(oldPaths) {
        console.log("--- Starting Full Migration with RRL ---");
        
        // 1. Преобразование и построение планов
        const fileList = await this.buildFileList(oldPaths);
        const processedData = await this.processFilelistForPlan(fileList);
        const finalPlan = this.assembleMigrationPlan(processedData);
        
        // 2. Выполнение RRL-копирования и синхронизации для каждого файла
        const migrationResults = [];
        
        for (const file of finalPlan.files) {
            try {
                const result = await this.rclone.executeRRLCopyAndSync(
                    file.sourcePath,
                    file.fullNewTargetPath
                );
                
                migrationResults.push({
                    source: file.sourcePath,
                    target: file.fullNewTargetPath,
                    success: result.success,
                    operationId: result.operationId
                });
            } catch (error) {
                migrationResults.push({
                    source: file.sourcePath,
                    target: file.fullNewTargetPath,
                    success: false,
                    error: error.message
                });
            }
        }

        // 3. Сохранение плана миграции
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const planPath = path.join(this.reportsDir, `migration_plan_${timestamp}.json`);
        await fs.writeFile(planPath, JSON.stringify(finalPlan, null, 2));

        return {
            success: true,
            planPath,
            migrationPlan: finalPlan,
            results: migrationResults,
            error: null
        };
    }

    /**
     * Строит список файлов из старых путей.
     * @param {string[]} oldPaths - Список старых путей.
     * @returns {Promise<Array<{path: string, modTime: string, fullPath: string}>>} Список файлов.
     */
    async buildFileList(oldPaths) {
        const fileList = [];
        
        for (const oldPath of oldPaths) {
            try {
                const stat = await fs.stat(oldPath);
                fileList.push({
                    path: stat.isDirectory ? oldPath : oldPath,
                    modTime: stat.mtime,
                    fullPath: oldPath
                });
            } catch (error) {
                // Файл/папка не существует - пропускаем
                console.warn(`⚠️ Файл не найден: ${oldPath}`);
            }
        }
        
        return fileList;
    }

    /**
     * Выполняет частичную миграцию с сохранением метаданных о перемещении.
     * @param {string[]} oldPaths - Список старых путей для миграции.
     * @param {boolean} preserveMetadata - Сохранять ли метаданные о перемещении.
     * @returns {Promise<Object>} Результат миграции.
     */
    async executePartialMigration(oldPaths, preserveMetadata = true) {
        console.log("--- Starting Partial Migration ---");
        
        const fileList = await this.buildFileList(oldPaths);
        const processedData = await this.processFilelistForPlan(fileList);
        const finalPlan = this.assembleMigrationPlan(processedData);
        
        // Создаем папки для миграции
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const migrationResults = [];
        
        for (const file of finalPlan.files) {
            try {
                // Создаем целевую папку
                const targetDir = path.dirname(file.fullNewTargetPath);
                await fs.mkdir(targetDir, { recursive: true });
                
                // Копируем файл
                await this.rclone.copyFile(file.sourcePath, file.fullNewTargetPath);
                
                migrationResults.push({
                    source: file.sourcePath,
                    target: file.fullNewTargetPath,
                    success: true,
                    operationId: Date.now().toString()
                });
            } catch (error) {
                migrationResults.push({
                    source: file.sourcePath,
                    target: file.fullNewTargetPath,
                    success: false,
                    error: error.message
                });
            }
        }

        // Сохраняем план миграции
        const planPath = path.join(this.reportsDir, `partial_migration_${timestamp}.json`);
        await fs.writeFile(planPath, JSON.stringify(finalPlan, null, 2));

        return {
            success: true,
            planPath,
            migrationPlan: finalPlan,
            results: migrationResults,
            error: null
        };
    }
}

module.exports = {
    MigrationEngine
};