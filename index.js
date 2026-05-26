/**
 * @fileoverview Точка входа CLI для выполнения миграционного плана каталогов.
 * Обрабатывает аргументы командной строки и запускает MigrationEngine.
 */

const fs = require('fs');
const path = require('path');
const getBatchFileMetadata = require('./src/utils/file-system.cjs');
const MigrationEngine = require('./src/engine/migration-engine.cjs');
const DetectionService = require('./src/services/detection-service.cjs');

// --- Инициализация Rclone Manager ---
/**
 * @class RcloneManager
 * @description Инкапсулирует все API-вызовы rclone, обеспечивая единую точку входа и управление состоянием соединений.
 */
class RcloneManager {
    /**
     * @param {string} remoteName - Имя rclone репозитория (e.g., "ya:").
     * @param {object} rcloneWrapper - Экземпляр RcloneWrapper.
     */
    constructor(remoteName, rcloneWrapper) {
        this.remoteName = remoteName;
        this.wrapper = rcloneWrapper;
    }

    /**
     * Инициализирует сервис rclone.
     * @returns {Promise<boolean>} true, если сервис доступен.
     */
    async initializeRcloneService() {
        console.log("⚙️ Инициализация Rclone Service...");
        try {
            // Проверяем подключение, пытаясь получить структурированный список содержимого.
            const checkResult = await this.wrapper.listStructured(null, this.remoteName);
            
            if (!checkResult) {
                console.error(`❌ Не удалось инициализировать сервис: ${this.remoteName} недоступен или пуст.`);
                return false;
            }
            
            console.log(`✅ Rclone Service успешно инициализирован для ${this.remoteName}.`);
            return true;
        } catch (e) {
            console.error("❌ Критическая ошибка при инициализации rclone service:", e.message);
            return false;
        }
    }

    /**
     * Проверяет доступность удаленного хранилища по заданному имени.
     * @param {string} remoteName - Полное имя удаленного хранилища (e.g., "ya:").
     * @returns {Promise<RcloneConnectionResult>} Результат проверки.
     */
    async testRemoteConnection(remoteName) {
        console.log(`🩺 Проверка соединения с ${remoteName}...`);
        try {
            // Используем rclone lsjson для проверки существования remotes и получения метрик
            const { stdout, stderr } = await this.wrapper.listStructured(null, remoteName);

            if (stderr) {
                console.error("❌ Ошибка rclone при проверке соединения:", stderr);
                return { success: false, message: stderr || "Не удалось подключиться к хранилищу." };
            }
            
            // Простая проверка на пустой или некорректный JSON
            if (!stdout) {
                return { success: false, message: "Получен пустой ответ от rclone." };
            }

            const metrics = await this.wrapper.calculateMetrics(JSON.parse(stdout));

            return {
                success: true,
                message: `Успешно подключено. ${metrics.message}`,
                usage: metrics.usage,
            };
        } catch (e) {
            console.error("❌ Критическая ошибка при проверке соединения:", e.message);
            return { success: false, message: `Ошибка: ${e.message}` };
        }
    }

    /**
     * Выполняет операцию копирования с использованием rclone copy.
     * @param {string} sourceRemote - Удаленное хранилище источника.
     * @param {string} srcPath - Путь источника.
     * @param {string} destRemote - Удаленное хранилище назначения.
     * @param {string} dstPath - Путь назначения.
     * @returns {Promise<RcloneCopyResult>} Результат копирования.
     */
    async copyFiles(sourceRemote, srcPath, destRemote, dstPath) {
        if (sourceRemote !== this.remoteName || destRemote !== this.remoteName) {
             return { success: false, operationId: "N/A", skippedFiles: [`Both remotes must match configured remote: ${this.remoteName}`] };
        }
        console.log(`⚡️ Начинается копирование с ${srcPath} в ${dstPath}`);
        
        // Используем wrapper.copy для выполнения rclone copy
        const result = await this.wrapper.copy(srcPath, dstPath);
        
        if (result.success) {
            return { success: true, operationId: Date.now().toString(), skippedFiles: [] };
        } else {
            return { success: false, operationId: Date.now().toString(), skippedFiles: [`Error: ${result.error || 'Unknown copy error'}`] };
        }
    }
}

// Экземпляр RcloneManager, инициализированный для работы
const rcloneManager = new RcloneManager(REMOTE, rcloneWrapper);
// --- Инициализация Rclone Manager ---
/**
 * @class RcloneManager
 * @description Инкапсулирует все API-вызовы rclone, обеспечивая единую точку входа и управление состоянием соединений.
 */
class RcloneManager {
    /**
     * @param {string} remoteName - Имя rclone репозитория (e.g., "ya:").
     * @param {object} rcloneWrapper - Экземпляр RcloneWrapper.
     */
    constructor(remoteName, rcloneWrapper) {
        this.remoteName = remoteName;
        this.wrapper = rcloneWrapper;
    }

    /**
     * Инициализирует сервис rclone.
     * @returns {Promise<boolean>} true, если сервис доступен.
     */
    async initializeRcloneService() {
        console.log("⚙️ Инициализация Rclone Service...");
        try {
            // Проверяем подключение, пытаясь получить структурированный список содержимого.
            const checkResult = await this.wrapper.listStructured(null, this.remoteName);
            
            if (!checkResult) {
                console.error(`❌ Не удалось инициализировать сервис: ${this.remoteName} недоступен или пуст.`);
                return false;
            }
            
            console.log(`✅ Rclone Service успешно инициализирован для ${this.remoteName}.`);
            return true;
        } catch (e) {
            console.error("❌ Критическая ошибка при инициализации rclone service:", e.message);
            return false;
        }
    }

    /**
     * Проверяет доступность удаленного хранилища по заданному имени.
     * @param {string} remoteName - Полное имя удаленного хранилища (e.g., "ya:").
     * @returns {Promise<RcloneConnectionResult>} Результат проверки.
     */
    async testRemoteConnection(remoteName) {
        console.log(`🩺 Проверка соединения с ${remoteName}...`);
        try {
            // Используем rclone lsjson для проверки существования remotes и получения метрик
            const { stdout, stderr } = await this.wrapper.listStructured(null, remoteName);

            if (stderr) {
                console.error("❌ Ошибка rclone при проверке соединения:", stderr);
                return { success: false, message: stderr || "Не удалось подключиться к хранилищу." };
            }
            
            // Простая проверка на пустой или некорректный JSON
            if (!stdout) {
                return { success: false, message: "Получен пустой ответ от rclone." };
            }

            const metrics = await this.wrapper.calculateMetrics(JSON.parse(stdout));

            return {
                success: true,
                message: `Успешно подключено. ${metrics.message}`,
                usage: metrics.usage,
            };
        } catch (e) {
            console.error("❌ Критическая ошибка при проверке соединения:", e.message);
            return { success: false, message: `Ошибка: ${e.message}` };
        }
    }

    /**
     * Выполняет операцию копирования с использованием rclone copy.
     * @param {string} sourceRemote - Удаленное хранилище источника.
     * @param {string} srcPath - Путь источника.
     * @param {string} destRemote - Удаленное хранилище назначения.
     * @param {string} dstPath - Путь назначения.
     * @returns {Promise<RcloneCopyResult>} Результат копирования.
     */
    async copyFiles(sourceRemote, srcPath, destRemote, dstPath) {
        if (sourceRemote !== this.remoteName || destRemote !== this.remoteName) {
             return { success: false, operationId: "N/A", skippedFiles: [`Both remotes must match configured remote: ${this.remoteName}`] };
        }
        console.log(`⚡️ Начинается копирование с ${srcPath} в ${dstPath}`);
        
        // Используем wrapper.copy для выполнения rclone copy
        const result = await this.wrapper.copy(srcPath, dstPath);
        
        if (result.success) {
            return { success: true, operationId: Date.now().toString(), skippedFiles: [] };
        } else {
            return { success: false, operationId: Date.now().toString(), skippedFiles: [`Error: ${result.error || 'Unknown copy error'}`] };
        }
    }
}

// Экземпляр RcloneManager, инициализированный для работы
const rcloneManager = new RcloneManager(REMOTE, rcloneWrapper);
// --- Инициализация Rclone Manager ---
/**
 * @class RcloneManager
 * @description Инкапсулирует все API-вызовы rclone, обеспечивая единую точку входа и управление состоянием соединений.
 */
class RcloneManager {
    /**
     * @param {string} remoteName - Имя rclone репозитория (e.g., "ya:").
     * @param {object} rcloneWrapper - Экземпляр RcloneWrapper.
     */
    constructor(remoteName, rcloneWrapper) {
        this.remoteName = remoteName;
        this.wrapper = rcloneWrapper;
    }

    /**
     * Инициализирует сервис rclone.
     * @returns {Promise<boolean>} true, если сервис доступен.
     */
    async initializeRcloneService() {
        console.log("⚙️ Инициализация Rclone Service...");
        try {
            // Проверяем подключение, пытаясь получить структурированный список содержимого.
            const checkResult = await this.wrapper.listStructured(null, this.remoteName);
            
            if (!checkResult) {
                console.error(`❌ Не удалось инициализировать сервис: ${this.remoteName} недоступен или пуст.`);
                return false;
            }
            
            console.log(`✅ Rclone Service успешно инициализирован для ${this.remoteName}.`);
            return true;
        } catch (e) {
            console.error("❌ Критическая ошибка при инициализации rclone service:", e.message);
            return false;
        }
    }

    /**
     * Проверяет доступность удаленного хранилища по заданному имени.
     * @param {string} remoteName - Полное имя удаленного хранилища (e.g., "ya:").
     * @returns {Promise<RcloneConnectionResult>} Результат проверки.
     */
    async testRemoteConnection(remoteName) {
        console.log(`🩺 Проверка соединения с ${remoteName}...`);
        try {
            // Используем rclone lsjson для проверки существования remotes и получения метрик
            const { stdout, stderr } = await this.wrapper.listStructured(null, remoteName);

            if (stderr) {
                console.error("❌ Ошибка rclone при проверке соединения:", stderr);
                return { success: false, message: stderr || "Не удалось подключиться к хранилищу." };
            }
            
            // Простая проверка на пустой или некорректный JSON
            if (!stdout) {
                return { success: false, message: "Получен пустой ответ от rclone." };
            }

            const metrics = await this.wrapper.calculateMetrics(JSON.parse(stdout));

            return {
                success: true,
                message: `Успешно подключено. ${metrics.message}`,
                usage: metrics.usage,
            };
        } catch (e) {
            console.error("❌ Критическая ошибка при проверке соединения:", e.message);
            return { success: false, message: `Ошибка: ${e.message}` };
        }
    }

    /**
     * Выполняет операцию копирования с использованием rclone copy.
     * @param {string} sourceRemote - Удаленное хранилище источника.
     * @param {string} srcPath - Путь источника.
     * @param {string} destRemote - Удаленное хранилище назначения.
     * @param {string} dstPath - Путь назначения.
     * @returns {Promise<RcloneCopyResult>} Результат копирования.
     */
    async copyFiles(sourceRemote, srcPath, destRemote, dstPath) {
        if (sourceRemote !== this.remoteName || destRemote !== this.remoteName) {
             return { success: false, operationId: "N/A", skippedFiles: [`Both remotes must match configured remote: ${this.remoteName}`] };
        }
        console.log(`⚡️ Начинается копирование с ${srcPath} в ${dstPath}`);
        
        // Используем wrapper.copy для выполнения rclone copy
        const result = await this.wrapper.copy(srcPath, dstPath);
        
        if (result.success) {
            return { success: true, operationId: Date.now().toString(), skippedFiles: [] };
        } else {
            return { success: false, operationId: Date.now().toString(), skippedFiles: [`Error: ${result.error || 'Unknown copy error'}`] };
        }
    }
}

// Экземпляр RcloneManager, инициализированный для работы
const rcloneManager = new RcloneManager(REMOTE, rcloneWrapper);

/**
 * Основная функция, которая компилирует и сохраняет план миграции.
 * @param {string[]} fileList - Список файлов для анализа.
 */
async function compileMigrationPlan(fileList) {
    console.log("\n======================================================================================");
    console.log("         🚀 ЗАПУСК МИГРАЦИОННОГО АНАЛИЗА И СБОР ПЛАНА");
    console.log("================================================================================================");

    try {
        // 1. Инициализация сервисов
        const detectionService = new DetectionService();
        // rcloneToolsMock используется только для передачи в конструктор, 
        // так как getBatchFileMetadata уже имитирует метаданные.
        const mockRcloneTools = { getOnlyDuplicateGroups: async () => [] };
module.exports = main;
        // 2. Запуск оркестратора
        const { plan, reports } = await migrationEngine.runPlan(fileList);

        // 3. Генерация и сохранение отчета
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFileName = `migration_plan_${timestamp}.json`;
        const reportPath = path.join('./reports', reportFileName);

        const finalOutput = {
            reportGeneratedAt: new Date().toISOString(),
            sourceDirectory: 'N/A',
            metadata: {
                totalFilesProcessed: plan.totalFilesProcessed
            },
            migrationPlan: plan.migrationPlan,
            classificationReports: reports
        };

        const jsonString = JSON.stringify(finalOutput, null, 2);
        fs.writeFileSync(reportPath, jsonString);

        console.log("\n========================================================================================");
        console.log("🎉 УСПЕШНО СОЗДАНО: План миграции.");
        console.log(`Файл сохранен в: ${reportPath}`);
        console.log("==========================================================================================");

    } catch (error) {
        console.error("\n❌ КРИТИЧЕСКАЯ ОШИБКА при выполнении миграции:", error);
        process.exit(1);
    }
}

module.exports = async function main() {
    const args = process.argv.slice(2);
    const compileFlagIndex = args.indexOf('--compile-migration-plan');

    if (compileFlagIndex === -1) {
        console.log("ℹ️ Не указан флаг --compile-migration-plan. Выход.");
        return;
    }

    // Если флаг найден, нам нужны все последующие аргументы как пути к директориям
    const targetDirectories = args.slice(compileFlagIndex + 1);

    if (targetDirectories.length === 0) {
        console.error("\n❌ Ошибка: После флага --compile-migration-plan должны быть указаны пути к каталогам для анализа.");
        return;
    }

    console.log(`\n--- Обнаружен режим компиляции плана миграции ---`);

    // В реальном проекте, мы бы собирали ВСЕ файлы из всех переданных каталогов.
    // Используем имитацию сканирования для примера.
    let allFiles = [];
    for (const dir of targetDirectories) {
        const filesInDir = await getBatchFileMetadata(dir);
        allFiles = allFiles.concat(filesInDir);
    }

    if (allFiles.length === 0) {
        console.log("⚠️ Не обнаружено файлов для анализа. Завершение.");
        return;
    }

    await compileMigrationPlan(allFiles);

    // ************************************************************
    // НОВЫЙ БЛОК: ДЕМОНСТРАЦИЯ КОПИРОВАНИЯ ПАПКИ (Яндекс Диск -> Локально)
    // ********************************
    console.log('\n===============================================================================');
    console.log('📦 ДЕМО: Выполнение задания "Скопировать папку с Яндекс Диска"');
    console.log('===============================================================================');

    const sourcePath = 'ya:MySourceFolder'; // <-- Исходная папка на Яндекс Диске
    const destPath = path.join(process.cwd(), 'copied_data'); // <-- Локальная папка назначения

    console.log(`\nНачинаем копирование: ${sourcePath} -> ${destPath}`);

    // 1. Создаем целевую директорию, если она не существует
    try {
        await require('fs').promises.mkdir(destPath, { recursive: true });
        console.log(`✅ Целевая директория готова.`);
    } catch (e) {
        console.error(`❌ Не удалось создать целевую директорию: ${e.message}`);
        return; // Прерываем выполнение
    }

    // 2. Вызываем rcloneTools для копирования
    try {
        const copyResult = await rcloneTools.copyDirectory(sourcePath, destPath);

        if (copyResult.success) {
            console.log('\n✨ УСПЕХ: Копирование папки с Яндекс Диска завершено!');
            console.log(`Результат: ${copyResult.message}`);
        } else {
            console.error('\n❌ ОШИБКА: Не удалось скопировать папку с Яндекс Диска.');
            console.error(`Детали ошибки: ${copyResult.error}`);
        }
    } catch (error) {
        console.error(`\n🛑 КРИТИЧЕСКАЯ ОШИБКА при вызове copyDirectory:`, error.message);
    }
}