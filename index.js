/**
 * @fileoverview Точка входа CLI для выполнения миграционного плана каталогов.
 * Обрабатывает аргументы командной строки и запускает MigrationEngine.
 */

const fs = require('fs');
const path = require('path');
const { getBatchFileMetadata } = require('./src/utils/file-system');
const MigrationEngine = require('./src/engine/migration-engine');
const DetectionService = require('./src/services/detection-service');

// --- Мок-инструменты ---
// Поскольку rcloneTools.js не предоставлен, создадим мок-функцию для симуляции вызова.
/**
 * Моделирует получение списка файлов из rclone.
 * @param {string} directoryPath - Директория для сканирования.
 * @returns {Promise<string[]>} Массив относительных путей.
 */
async function listFilesFromRclone(directoryPath) {
    console.log(`[CLI] Симуляция сканирования каталога: ${directoryPath}`);
    // Имитируем список файлов, включая разные типы и ID
    return [
        "folder/images/photo_001.jpg",        // Image
        "folder/documents/invoice_2024_123.pdf", // Document, Finance
        "archive/old_data.zip",             // Archive
        "file_with_id_ID:BS-TX123/data.json", // ID format
        "folder/media/photo_002.png",        // Image
        "documents/report_general.doc",     // Document, Report
        "source_file.txt",                   // General text
        "folder/images/photo_003.jpeg",
        "another_folder/receipt_2023.pdf",   // Document, Finance
        "folder/general/readme.md",         // Report
    ];
}

/**
 * Основная функция, которая компилирует и сохраняет план миграции.
 * @param {string[]} fileList - Список файлов для анализа.
 */
async function compileMigrationPlan(fileList) {
    console.log("\n=====================================================================");
    console.log("         🚀 ЗАПУСК МИГРАЦИОННОГО АНАЛИЗА И СБОР ПЛАНА");
    console.log("=====================================================================");

    try {
        // 1. Инициализация сервисов
        const detectionService = new DetectionService();
        // rcloneToolsMock используется только для передачи в конструктор, 
        // так как getBatchFileMetadata уже имитирует метаданные.
        const mockRcloneTools = { getOnlyDuplicateGroups: async () => [] };

        const migrationEngine = new MigrationEngine(mockRcloneTools, detectionService);

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

        console.log("\n=====================================================================");
        console.log("🎉 УСПЕШНО СОЗДАНО: План миграции.");
        console.log(`Файл сохранен в: ${reportPath}`);
        console.log("=====================================================================");

    } catch (error) {
        console.error("\n❌ КРИТИЧЕСКАЯ ОШИБКА при выполнении миграции:", error);
        process.exit(1);
    }
}

/**
 * Основная точка входа CLI.
 */
async function main() {
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
    // ************************************************************
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
