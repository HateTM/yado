/**
 * @fileoverview Точка входа CLI для выполнения миграционного плана каталогов.
 * Обрабатывает аргументы командной строки и запускает MigrationEngine.
 */

const fs = require('fs').promises;
const path = require('path');
const { getBatchFileMetadata } = require('./src/utils/file-system.cjs');
const MigrationEngine = require('./src/engine/migration-engine.cjs');
const DetectionService = require('./src/services/detection-service.cjs'); // Исправленный импорт
const RcloneManager = require('./rcloneTools.cjs'); // Импортируем исправленный RcloneManager
const { executeRcloneCommand } = require('./src/utils/rclone-cli-wrapper.js');
// --- Константы ---
const REMOTE = 'ya:';
const REPORTS_DIR = 'reports';

// Экземпляр RcloneManager
const rcloneManager = new RcloneManager(REMOTE, require('./src/utils/rclone-cli-wrapper.js'));

async function scanRemoteDirectory(remoteName, remotePath) {
    try {
        const command = `rclone lsjson "${remoteName}${remotePath}" --dirs-only`;
        const result = await executeRcloneCommand(command);

        if (!result.success) {
            throw new Error(`Rclone ошибка: ${result.error}`);
        }

        // Парсим вывод rclone lsjson
        const items = JSON.parse(result.stdout);
        const filePaths = [];

        for (const item of items) {
            const fullPath = `${remotePath}/${item.Path}`;
            if (item.IsDir) {
                // Рекурсивно сканируем подпапки
                const subFiles = await scanRemoteDirectory(remoteName, fullPath);
                filePaths.push(...subFiles);
            } else {
                filePaths.push(fullPath);
            }
        }
        return filePaths;
    } catch (error) {
        console.error(`❌ Ошибка при сканировании удалённого каталога ${remoteName}${remotePath}:`, error.message);
        throw error;
    }
}


/**
 * Рекурсивно получает список абсолютных путей ко всем файлам в директории.
 * @param {string} dir - Путь к директории.
 * @returns {Promise<string[]>} Массив абсолютных путей к файлам.
 */
async function getFilePathsRecursively(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
        const fullPath = path.join(dir, entry.name);

        // Фильтруем мусорные записи: пропускаем пути с \, mkdir и т. д.
        if (entry.name.includes('\\') || entry.name.includes('mkdir')) {
            return null;
        }

        if (entry.isDirectory()) {
            return getFilePathsRecursively(fullPath);
        } else {
            return fullPath;
        }
    }));
    // Фильтруем null и flatten массив
    return files.flat().filter(Boolean);
}

/**
 * Основная функция, которая компилирует и сохраняет план миграции по списку путей к файлам.
 * @param {string[]} filePaths - Список абсолютных путей к файлам для анализа.
 */
async function compileMigrationPlanFromPaths(filePaths) {
    console.log('\n======================================================================================');
    console.log('         🚀 ЗАПУСК МИГРАЦИОННОГО АНАЛИЗА И СБОР ПЛАНА');
    console.log('===============================================================================================');

    try {
        // 1. Инициализация сервисов
        const detectionService = new DetectionService(); // Создаём экземпляр
        const migrationEngine = new MigrationEngine(detectionService, rcloneManager);

        // 2. Запуск оркестратора
        const result = await migrationEngine.runPlan(filePaths);

        // 3. Генерация и сохранение отчёта
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFileName = `migration_plan_${timestamp}.json`;
        const reportPath = path.join(REPORTS_DIR, reportFileName);

        await fs.mkdir(REPORTS_DIR, { recursive: true });

        const finalOutput = {
            reportGeneratedAt: new Date().toISOString(),
            sourceDirectory: filePaths[0] ? path.dirname(filePaths[0]) : 'N/A',
            metadata: {
                totalFilesProcessed: result.plan.totalFilesProcessed
            },
            migrationPlan: result.plan.migrationPlan,
            classificationReports: result.reports
        };

        const jsonString = JSON.stringify(finalOutput, null, 2);
        await fs.writeFile(reportPath, jsonString);

        console.log('\n=======================================================================================');
        console.log('🎉 УСПЕШНО СОЗДАНО: План миграции.');
        console.log(`Файл сохранён в: ${reportPath}`);
        console.log('========================================================================================');
    } catch (error) {
        console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА при выполнении миграции:', error);
        process.exit(1);
    }
}

/**
 * Проверяет существование папки на удалённом хранилище.
 * @param {string} remoteName - Имя удалённого хранилища (например, "ya:").
 * @param {string} folderPath - Путь к папке для проверки.
 * @returns {Promise<boolean>} true, если папка существует.
 */
async function checkRemoteFolderExists(remoteName, folderPath) {
    try {
        const result = await executeRcloneCommand(`rclone lsjson "${remoteName}${folderPath}"`);
        if (!result.success) {
            return false;
        }
        return true;
    } catch (error) {
        console.error(`❌ Ошибка при проверке папки ${remoteName}${folderPath}:`, error.message);
        return false;
    }
}

/**
 * Демонстрирует копирование папки с Яндекс Диска на локальную машину.
 */
async function demonstrateFolderCopy() {
    console.log('\n===============================================================================');
    console.log('📦 ДЕМО: Выполнение задания "Скопировать папку с Яндекс Диска"');
    console.log('===============================================================================');

    const sourcePath = 'MySourceFolder';
    const destPath = path.join(process.cwd(), 'copied_data');

    console.log(`\nНачинаем копирование: ${REMOTE}${sourcePath} -> ${destPath}`);

    // 1. Проверяем существование папки на Яндекс Диске
    console.log('🔎 Проверяем существование папки на Яндекс Диске...');
    const folderExists = await checkRemoteFolderExists(REMOTE, sourcePath);
    if (!folderExists) {
        console.error(`❌ ОШИБКА: Папка ${REMOTE}${sourcePath} не найдена на Яндекс Диске.`);
        console.log('💡 Возможные решения:');
        console.log('   • Создайте папку MySourceFolder на Яндекс Диске: rclone mkdir ya:MySourceFolder');
        console.log('   • Загрузите в неё тестовые файлы');
        console.log('   • Измените sourcePath на существующую папку (например, Migrated)');
        return;
    }
    console.log('✅ Папка найдена на Яндекс Диске.');

    // 2. Создаём целевую директорию
    try {
        await fs.mkdir(destPath, { recursive: true });
        console.log('✅ Целевая директория готова.');
    } catch (e) {
        console.error(`❌ Не удалось создать целевую директорию: ${e.message}`);
        return;
    }

    // 3. Выполняем копирование
    try {
        const copyResult = await rcloneManager.copyFiles(
            REMOTE,
            sourcePath,
            '',
            destPath
        );

        if (copyResult.success) {
            console.log('\n✨ УСПЕХ: Копирование папки с Яндекс Диска завершено!');
            console.log(`Операция ID: ${copyResult.operationId}`);
        } else {
            console.error('\n❌ ОШИБКА: Не удалось скопировать папку с Яндекс Диска.');
            console.error(`Детали ошибки: ${copyResult.skippedFiles.join(', ')}`);
        }
    } catch (error) {
        console.error('\n🛑 КРИТИЧЕСКАЯ ОШИБКА при вызове copyFiles:', error.message);
    }
}



module.exports = async function main() {
    const args = process.argv.slice(2);

    const compileFlagIndex = args.indexOf('--compile-migration-plan');
    const runDemoFlag = args.includes('--run-demo');

    // Если нет аргументов, показываем справку
    if (args.length === 0) {
        console.log(`
📋 Доступные команды:
  node index.js --compile-migration-plan <путь_к_каталогу>
    - Анализирует файлы и создаёт план миграции

  node index.js --run-demo
    - Запускает демонстрационное копирование с Яндекс Диска

Пример:
  node index.js --compile-migration-plan ./test-data
  `);
        return;
    }

    // Если флаг компиляции не найден, но есть другие аргументы
    if (compileFlagIndex === -1 && !runDemoFlag) {
        console.error('❌ Неизвестный флаг. Используйте --compile-migration-plan или --run-demo');
        return;
    }

    if (compileFlagIndex !== -1) {
        const targetDirectories = args.slice(compileFlagIndex + 1);

        if (targetDirectories.length === 0) {
            console.error('\n❌ Ошибка: После флага --compile-migration-plan должны быть указаны пути к каталогам для анализа.');
            return;
        }

        console.log('\n--- Обнаружен режим компиляции плана миграции ---');

        let allFiles = [];
        for (const dir of targetDirectories) {
            try {
                // Определяем, является ли путь удалённым (начинается с ya:)
                if (dir.startsWith('ya:')) {
                    const remotePath = dir.replace('ya:', '');
                    console.log(`🔎 Сканируем удалённый каталог: ${dir}`);
                    const remoteFiles = await scanRemoteDirectory('ya:', remotePath);
                    allFiles = allFiles.concat(remoteFiles);
                } else {
                    // Для совместимости: локальное сканирование
                    console.log(`🔎 Сканируем локальный каталог: ${dir}`);
                    const localFiles = await getFilePathsRecursively(dir);
                    allFiles = allFiles.concat(localFiles);
                }
            } catch (error) {
                console.error(`❌ Ошибка при сканировании каталога ${dir}:`, error.message);
                continue;
            }
        }

        if (allFiles.length === 0) {
            console.log('⚠️ Не обнаружено файлов для анализа. Завершение.');
            return;
        }

        await compileMigrationPlanFromPaths(allFiles);
    }

    if (runDemoFlag) {
        // Отдельная обработка демо‑режима
        console.log('\n--- Запущен демо‑режим копирования ---');
        await demonstrateFolderCopy();
    }
};

// Запуск, если файл выполняется напрямую
if (require.main === module) {
    module.exports().catch(console.error);
}
