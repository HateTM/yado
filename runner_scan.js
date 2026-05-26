#!/usr/bin/env node

/**
 * Скрипт для сканирования папок и выгрузки списка файлов в CSV
 */

const { join, dirname } = require("path");
const { readdir, readFile } = require("fs/promises");
const { writeFile, mkdir } = require("fs/promises");
const path = require('path');
const { exec } = require('child_process');

// Импорт необходимых функций
const executeRcloneCommand = require('./src/utils/rclone-cli-wrapper').executeRcloneCommand;
const Logger = require('./src/utils/LoggingService.cjs');
const { parseBypassLinks } = require('./src/utils/bsRegexParser.cjs');

/**
 * Получает список объектов rclone для указанного пути
 * @param {string} remotePath - Путь для сканирования (e.g., "ya:Базовые_станции/")
 * @returns {Promise<Array>} Массив объектов файлов
 */
async function getRcloneObjects(remotePath) {
    try {
        const command = `rclone lsjson "${remotePath}" --recursive`;
        const result = await executeRcloneCommand(command);
        
        if (!result.success) {
            throw new Error(`Ошибка rclone: ${result.stderr}`);
        }
        
        const items = result.result?.parsed_json || result.result?.items || [];
        return items;
    } catch (error) {
        console.error('Ошибка при получении списка объектов:', error.message);
        throw error;
    }
}

/**
 * Извлекает файлы из указанной папки
 * @param {string} folderPath - Полный путь к папке (e.g., "ya:Базовые_станции/ID_БС/")
 * @returns {Promise<Array>} Массив файлов
 */
async function getFilesFromFolder(folderPath) {
    try {
        const command = `rclone lsf "${folderPath}"`;
        const result = await executeRcloneCommand(command);
        
        if (!result.success) {
            throw new Error(`Ошибка rclone: ${result.stderr}`);
        }
        
        const files = result.result.split('\n').filter(f => f && !f.endsWith('/'));
        return files;
    } catch (error) {
        console.error('Ошибка при получении файлов из папки:', error.message);
        throw error;
    }
}

/**
 * Извлекает файлы из всех папок в указанной директории
 * @param {string} rootPath - Корневой путь (e.g., "ya:Базовые_станции/")
 * @returns {Promise<Array>} Массив файлов
 */
async function getAllFilesInFolder(rootPath) {
    try {
        const command = `rclone lsf "${rootPath}" --files-only`;
        const result = await executeRcloneCommand(command);
        
        if (!result.success) {
            throw new Error(`Ошибка rclone: ${result.stderr}`);
        }
        
        // Фильтруем пути и извлекаем файлы
        const files = result.result.split('\n')
            .filter(line => line && !line.endsWith('/'))
            .map(line => {
                const parts = line.split('/');
                return parts[parts.length - 1];
            });
        
        return files;
    } catch (error) {
        console.error('Ошибка при получении всех файлов из папки:', error.message);
        throw error;
    }
}

/**
 * Извлекает информацию о всех папках в директории
 * @param {string} rootPath - Корневой путь
 * @returns {Promise<Array>} Массив папок
 */
async function getFoldersInFolder(rootPath) {
    try {
        const command = `rclone lsd "${rootPath}"`;
        const result = await executeRcloneCommand(command);
        
        if (!result.success) {
            throw new Error(`Ошибка rclone: ${result.stderr}`);
        }
        
        // Разбираем JSON результат
        const folders = [];
        const jsonOutput = JSON.parse(result.result);
        
        for (const folder of jsonOutput) {
            folders.push(folder.Path.split('/').pop());
        }
        
        return folders;
    } catch (error) {
        console.error('Ошибка при получении папок:', error.message);
        throw error;
    }
}

/**
 * Получает список всех директорий в указанной папке rclone
 * @param {string} remotePath - Путь к директории
 * @returns {Promise<Array>} Массив названий директорий
 */
async function getRemoteDirectories(remotePath) {
    try {
        const command = `rclone lsd "${remotePath}"`;
        const result = await executeRcloneCommand(command);
        
        if (!result.success) {
            throw new Error(`Ошибка rclone: ${result.stderr}`);
        }
        
        // rclone lsd возвращает JSON с путями папок
        const jsonResult = JSON.parse(result.result);
        const dirs = Object.keys(jsonResult).map(name => 
            name.split('/').pop()
        );
        
        return dirs;
    } catch (error) {
        console.error('Ошибка при получении директорий:', error.message);
        throw error;
    }
}

/**
 * Формирует CSV контент из объектов rclone
 * @param {Array} objects - Массив объектов rclone
 * @returns {string} CSV содержимое
 */
function formatObjectsToCSV(objects) {
    const headers = [
        'Path', 'Size', 'IsDir', 'Hash', 'ModTime', 'MimeType'
    ];
    
    const rows = objects.map(obj => {
        const hash = obj.Hash || '';
        const modTime = obj.ModTime || '';
        const mimeType = obj.MimeType || '';
        
        return [
            obj.Path.replace(/"/g, '""'),
            obj.Size,
            obj.IsDir || 'false',
            hash,
            modTime,
            mimeType
        ].map(v => `"${v}"`).join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
}

/**
 * Основная функция сканирования
 * @param {string} basePath - База путей (e.g., "ya:Базовые_станции/")
 * @param {object} config - Конфигурация сканирования
 * @returns {Promise<void>}
 */
async function scanAndExport(basePath, config = {}) {
    const {
        foldersOnly = false,
        skipFirstLevel = false,
        useHash = false,
        outputFormat = 'all' // 'all', 'files', 'folders', 'with_size', 'with_hash'
    } = config;

    console.log(`📁 Сканирование директории: ${basePath}`);

    try {
        // Получаем все файлы
        const allObjects = await getRcloneObjects(basePath);
        
        if (allObjects.length === 0) {
            console.log('⚠️ Директория пуста или не найдена');
            return;
        }
        
        console.log(`✅ Найдено объектов: ${allObjects.length}`);
        
        // Фильтруем файлы и папки
        const files = allObjects.filter(obj => !obj.IsDir);
        const folders = allObjects.filter(obj => obj.IsDir);
        
        // Получаем список папок
        const foldersInFolder = await getFoldersInFolder(basePath);
        console.log(`📂 Найдено папок: ${foldersInFolder.length}`);
        
        // Формируем CSV контент
        let csvContent = '';
        
        if (outputFormat === 'all' || outputFormat === 'files') {
            csvContent += '=== FILES ===\n';
            const filesCsv = formatObjectsToCSV(files);
            csvContent += filesCsv + '\n\n';
        }
        
        if (outputFormat === 'all' || outputFormat === 'folders') {
            csvContent += '=== FOLDERS ===\n';
            const foldersCsv = formatObjectsToCSV(folders);
            csvContent += foldersCsv;
        }
        
        if (outputFormat === 'all') {
            csvContent += '\n\n=== ALL OBJECTS ===\n';
            const allCsv = formatObjectsToCSV(allObjects);
            csvContent += allCsv;
        }
        
        // Сохраняем CSV
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputDir = config.outputDir || 'ya_copy';
        const outputPath = join(outputDir, `scan_${basePath.replace(/:/, '_')}_${timestamp}.csv`);
        
        await writeFile(outputPath, csvContent);
        console.log(`✅ CSV сохранён: ${outputPath}`);
        console.log(`📊 Файлы: ${files.length}, Папки: ${folders.length}, Всего: ${allObjects.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка сканирования:', error.message);
        Logger.logError(error);
    }
}

/**
 * Основная функция для обработки указанной директории
 * @param {string} folderPath - Путь к директории (e.g., "ya:Исполнительная_документация/")
 * @returns {Promise<void>}
 */
async function processFolder(folderPath) {
    console.log(`\n🔍 Обработка папки: ${folderPath}`);
    
    try {
        // Получаем список объектов
        const objects = await getRcloneObjects(folderPath);
        
        if (objects.length === 0) {
            console.log(`⚠️ Папка пуста: ${folderPath}`);
            return;
        }
        
        console.log(`✅ Находится объектов: ${objects.length}`);
        
        // Получаем файлы и папки
        const files = objects.filter(obj => !obj.IsDir);
        const folders = objects.filter(obj => obj.IsDir);
        
        // Создаём CSV для каждой категории
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputDir = 'ya_copy';
        const outputBase = folderPath.replace(/:/g, '_');
        
        // CSV всех объектов
        const allPath = join(outputDir, `${outputBase}_all_${timestamp}.csv`);
        const allCsv = formatObjectsToCSV(objects);
        await writeFile(allPath, allCsv);
        console.log(`✅ Сохранён: ${path.basename(allPath)}`);
        
        // CSV только файлов
        if (files.length > 0) {
            const filesPath = join(outputDir, `${outputBase}_files_${timestamp}.csv`);
            const filesCsv = formatObjectsToCSV(files);
            await writeFile(filesPath, filesCsv);
            console.log(`✅ Сохранён: ${path.basename(filesPath)}`);
        }
        
        // CSV только папок
        if (folders.length > 0) {
            const foldersPath = join(outputDir, `${outputBase}_folders_${timestamp}.csv`);
            const foldersCsv = formatObjectsToCSV(folders);
            await writeFile(foldersPath, foldersCsv);
            console.log(`✅ Сохранён: ${path.basename(foldersPath)}`);
        }
        
        // Создаём структуру директорий
        const dirsPath = join(outputDir, `${outputBase}_dirs_${timestamp}.json`);
        const dirStructure = {
            path: folderPath,
            folders: folders.map(f => ({
                name: f.Path.split('/').pop(),
                full_path: f.Path,
                size: 0,
                children: []
            })),
            timestamp: new Date().toISOString()
        };
        await writeFile(dirsPath, JSON.stringify(dirStructure, null, 2));
        console.log(`✅ Сохранена структура: ${path.basename(dirsPath)}`);
        
    } catch (error) {
        console.error(`❌ Ошибка обработки папки ${folderPath}:`, error.message);
        Logger.logError(error);
    }
}

/**
 * Сканирует указанную директорию и сохраняет результаты
 * @param {string} path - Путь к директории (e.g., "ya:Исполнительная_документация/")
 * @param {string} type - Тип обработки: 'files', 'folders', 'all'
 * @returns {Promise<void>}
 */
async function scanDirectory(path, type = 'all') {
    console.log(`\n📋 Сканирование: ${path} (тип: ${type})`);
    
    try {
        // Получаем все объекты
        const objects = await getRcloneObjects(path);
        
        // Фильтруем по типу
        let items;
        if (type === 'files') {
            items = objects.filter(obj => !obj.IsDir);
        } else if (type === 'folders') {
            items = objects.filter(obj => obj.IsDir);
        } else {
            items = objects;
        }
        
        if (items.length === 0) {
            console.log(`⚠️ Не найдено объектов типа ${type}`);
            return;
        }
        
        // Сохраняем результаты
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputDir = 'ya_copy';
        
        let outputPath;
        if (type === 'all') {
            outputPath = join(outputDir, `scan_${path.replace(/:/, '_')}_${timestamp}.csv`);
        } else {
            outputPath = join(outputDir, `scan_${path.replace(/:/, '_')}_${type}_${timestamp}.csv`);
        }
        
        const csvContent = formatObjectsToCSV(items);
        await writeFile(outputPath, csvContent);
        
        console.log(`✅ Результат сохранён: ${outputPath}`);
        console.log(`📊 Объектов: ${items.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка сканирования:', error.message);
        Logger.logError(error);
    }
}

/**
 * Генерирует карту миграции для всех директорий в базовой директории
 * @param {string} basePath - Базовая директория (e.g., "ya:Исполнительная_документация/")
 * @returns {Promise<void>}
 */
async function generateMigrationMap(basePath) {
    console.log(`\n🗺️ Генерация карты миграции для: ${basePath}`);
    
    try {
        // Получаем все папки
        const folders = await getFoldersInFolder(basePath);
        
        if (folders.length === 0) {
            console.log('⚠️ Папки не найдены');
            return;
        }
        
        console.log(`✅ Найдено папок: ${folders.length}`);
        
        // Для каждой папки получаем файлы
        const migrationMap = [];
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        
        for (const folderName of folders) {
            // Формируем полный путь к папке
            const folderPath = `${basePath}${folderName}/`;
            
            try {
                const files = await getFilesFromFolder(folderPath);
                
                if (files.length > 0) {
                    migrationMap.push({
                        folder: folderName,
                        folderPath,
                        fileCount: files.length,
                        files: files
                    });
                }
            } catch (error) {
                console.error(`⚠️ Ошибка обработки папки ${folderName}:`, error.message);
            }
        }
        
        // Сохраняем карту миграции
        const mapPath = join('ya_copy', `migration_map_${basePath.replace(/:/, '_')}_${timestamp}.json`);
        await writeFile(mapPath, JSON.stringify(migrationMap, null, 2));
        
        console.log(`✅ Карта миграции сохранена: ${mapPath}`);
        console.log(`📊 Обработано папок: ${migrationMap.length}, файлов: ${migrationMap.reduce((sum, m) => sum + m.fileCount, 0)}`);
        
    } catch (error) {
        console.error('❌ Ошибка генерации карты миграции:', error.message);
        Logger.logError(error);
    }
}

/**
 * Обработчик команды: быстрый скан
 */
async function quickScan(remotePath) {
    try {
        const command = `rclone lsjson "${remotePath}" --recursive`;
        const result = await executeRcloneCommand(command);
        
        if (!result.success) {
            throw new Error(`Ошибка rclone: ${result.stderr}`);
        }
        
        const items = result.result?.parsed_json || result.result?.items || [];
        const files = items.filter(i => !i.IsDir);
        const directories = items.filter(i => i.IsDir);
        
        console.log(`✅ Быстрый скан: папок=${directories.length}, файлов=${files.length}, всего=${items.length}`);
        
        // Сохраняем результат
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputPath = join('ya_copy', `quick_scan_${remotePath.replace(/:/, '_')}_${timestamp}.json`);
        
        const data = {
            path: remotePath,
            timestamp: new Date().toISOString(),
            total: items.length,
            files: files.length,
            directories: directories.length,
            items: items.slice(0, 100) // Ограничиваем количество для примера
        };
        
        await writeFile(outputPath, JSON.stringify(data, null, 2));
        console.log(`✅ Результат сохранён: ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Ошибка быстрого скана:', error.message);
        Logger.logError(error);
    }
}

/**
 * Обработчик команды: выгрузка содержимого папки
 */
async function exportFolderContent(folderPath) {
    try {
        const objects = await getRcloneObjects(folderPath);
        
        if (objects.length === 0) {
            console.log(`⚠️ Папка пуста: ${folderPath}`);
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputPath = join('ya_copy', `export_${folderPath.replace(/:/, '_')}_${timestamp}.csv`);
        const csvContent = formatObjectsToCSV(objects);
        
        await writeFile(outputPath, csvContent);
        console.log(`✅ Содержимое папки сохранено: ${outputPath}`);
        console.log(`📊 Объектов: ${objects.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка выгрузки папки:', error.message);
        Logger.logError(error);
    }
}

/**
 * Обработчик команды: анализ структуры
 */
async function analyzeStructure(rootPath) {
    try {
        const objects = await getRcloneObjects(rootPath);
        
        // Группируем по уровням
        const levels = {};
        const totalSize = 0;
        
        for (const obj of objects) {
            const pathParts = obj.Path.split('/').filter(p => p);
            let currentLevel = levels;
            
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                
                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        name: part,
                        count: 0,
                        totalSize: 0,
                        children: {}
                    };
                }
                
                currentLevel[part].count++;
                
                // Размер только для файлов
                if (!obj.IsDir) {
                    currentLevel[part].totalSize += obj.Size;
                    totalSize += obj.Size;
                }
                
                currentLevel = currentLevel[part].children;
            }
        }
        
        console.log(`🌲 Структура директории ${rootPath}`);
        console.log(`📊 Общий размер файлов: ${totalSize} байт`);
        console.log(`📊 Всего объектов: ${objects.length}`);
        
        // Сохраняем структуру
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const outputPath = join('ya_copy', `structure_${rootPath.replace(/:/, '_')}_${timestamp}.json`);
        
        const structure = {
            path: rootPath,
            timestamp: new Date().toISOString(),
            totalSize,
            tree: levels
        };
        
        await writeFile(outputPath, JSON.stringify(structure, null, 2));
        console.log(`✅ Структура сохранена: ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Ошибка анализа структуры:', error.message);
        Logger.logError(error);
    }
}

// Экспорт всех функций
module.exports = {
    getRcloneObjects,
    getFilesFromFolder,
    getAllFilesInFolder,
    getFoldersInFolder,
    getRemoteDirectories,
    formatObjectsToCSV,
    scanAndExport,
    processFolder,
    scanDirectory,
    generateMigrationMap,
    quickScan,
    exportFolderContent,
    analyzeStructure
};

/**
 * Обработчик CLI
 */
async function main(args) {
    const command = args[0];
    const pathArg = args[1];
    
    if (!command) {
        console.log('📋 Команды: quickScan, export, structure, scan');
        console.log('📍 Путь: ' + (pathArg || 'ya:Исполнительная_документация/'));
        return;
    }
    
    const path = pathArg || 'ya:Исполнительная_документация/';
    
    switch (command) {
        case 'quickScan':
            await quickScan(path);
            break;
        case 'export':
            await exportFolderContent(path);
            break;
        case 'structure':
            await analyzeStructure(path);
            break;
        case 'scan':
            await scanAndExport(path, {
                foldersOnly: false,
                skipFirstLevel: false,
                useHash: false,
                outputFormat: 'all'
            });
            break;
        default:
            console.log(`⚠️ Неизвестная команда: ${command}`);
            console.log('Доступные команды: quickScan, export, structure, scan');
    }
}

// Запуск если файл выполнен напрямую
if (require.main === module) {
    const args = process.argv.slice(2);
    main(args);
}