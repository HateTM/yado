/**
 * @file rcloneTools.js
 * @description Core utilities for interacting with cloud storage (Yandex Disk) using rclone.
 * Implements functions for duplicate detection, directory structure mapping, and reporting.
 *
 * NOTE: All public methods must be called in an async context.
 */

const { join, basename, dirname } = require("path");
const { writeFile, mkdir, readFile, writeFile: writeFileSync } = require("fs/promises");
const Logger = require('./src/utils/LoggingService.cjs');
const rcloneWrapper = require('./src/utils/rclone-cli-wrapper.js');
const { executeRcloneCommand } = rcloneWrapper;

// --- Быстрое сканирование через rclone lsjson ---

/**
 * Быстрое сканирование пути с использованием rclone lsjson для быстрой фильтрации по размеру
 * @param {string} remotePath - Путь для сканирования (например, "ya:Базовые_станции/")
 * @returns {Promise<{objects: Array, total: number, files: number, directories: number}>} Результаты сканирования
 */
async function fastScanPath(remotePath) {
    try {
        // Используем --hash none для ускорения (без вычисления хешей)
        const command = `rclone lsjson "${remotePath}" --recursive --hash none`;
        const result = await executeRcloneCommand(command);
        
        if (!result.success) {
            throw new Error(`Ошибка rclone: ${result.stderr}`);
        }
        
        const items = result.result?.parsed_json || result.result?.items || [];
        
        return {
            objects: items,
            total: items.length,
            files: items.filter(i => !i.IsDir).length,
            directories: items.filter(i => i.IsDir).length
        };
    } catch (error) {
        console.error('Ошибка быстрого сканирования:', error.message);
        throw error;
    }
}

/**
 * Извлекает информацию о базовых станциях из результатов быстрого сканирования
 * @param {object} scanResults - Результаты быстрого сканирования
 * @returns {object} Данные о базовых станциях
 */
function extractBaseStationData(scanResults) {
    const results = {
        total: 0,
        files: 0,
        directories: 0,
        baseStations: new Map()
    };
    
    for (const obj of (scanResults?.objects || [])) {
        results.total++;
        
        if (obj.path) {
            // Поиск паттернов ID БС
            const idMatch = obj.path.match(/BS\s*(\d{4,})/);
            if (idMatch) {
                const bsId = idMatch[1];
                const info = results.baseStations.get(bsId) || {
                    id: bsId,
                    matches: [],
                    cloudPath: null,
                    status: 'unknown'
                };
                
                info.matches.push({
                    path: obj.path,
                    size: obj.size,
                    isDirectory: obj.isdir
                });
                if (!info.cloudPath) info.cloudPath = obj.path;
                info.status = 'detected';
                break;
            }
        }
    }
    
    return results;
}

// --- Ути

// --- Утилиты для ID ---

/**
 * Извлекает чистый числовой компонент из строки ID.
 * @param {string} rawId - Исходная строка ID.
 * @returns {number|null} Числовой ID или null, если не найден.
 */
function getNumericId(rawId) {
    const match = rawId.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

/**
 * Определяет роли (Source/Target) для двух ID на основе их числового сравнения.
 * @param {string} idA - Первый ID.
 * @param {string} idB - Второй ID.
 * @returns {{primary: string, secondary: string, role: 'Source'|'Target'|'Equal'}} Объект с ролями.
 */
function determineRRLRoles(idA, idB) {
    const numA = getNumericId(idA);
    const numB = getNumericId(idB);

    if (numA === null || numB === null) {
        return { primary: idA, secondary: idB, role: 'Equal' };
    }

    if (numA < numB) {
        return { primary: idA, secondary: idB, role: 'Source' };
    } else if (numA > numB) {
        return { primary: idB, secondary: idA, role: 'Source' };
    } else {
        return { primary: idA, secondary: idB, role: 'Equal' };
    }
}

// --- Константы ---
const REMOTE = "ya:";
const REPORTS_DIR = "reports";

// --- Типы данных (JSDoc) ---

/**
 * @typedef {object} DirectoryMetrics
 * @property {number} fileCount - Total number of files.
 * @property {number} totalSizeBytes - Total size of files in bytes.
 */

/**
 * @typedef {object} DirectoryEntry
 * @property {string} name - Name of the directory/file.
 * @property {string} fullPath - Full path within the cloud storage.
 * @property {DirectoryMetrics} metrics - Metrics for the directory/file.
 */

/**
 * @typedef {object} RcloneConnectionResult
 * @property {boolean} success - Whether the connection was successful.
 * @property {string} message - Status message.
 * @property {object} [usage] - Storage usage metrics if available.
 */

/**
 * @typedef {object} RcloneCopyResult
 * @property {boolean} success - Whether the copy operation was successful.
 * @property {string} operationId - Unique identifier for the operation.
 * @property {string[]} skippedFiles - List of files that were skipped.
 */

/**
 * @class RcloneManager
 * @description Инкапсулирует все API-вызовы rclone, обеспечивая единую точку входа и управление состоянием соединений.
 */
class RcloneManager {
    /**
     * @param {string} remoteName - Имя rclone репозитория (e.g., "ya:").
     * @param {object} rcloneWrapper - Экземпляр RcloneWrapper.
     */
    constructor(remoteName = REMOTE, rcloneWrapper) {
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
            const checkResult = await this.testRemoteConnection(this.remoteName);
            if (!checkResult.success) {
                console.error(`❌ Не удалось инициализировать сервис: ${this.remoteName} недоступен.`);
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
            const result = await executeRcloneCommand(`rclone lsjson ${remoteName}`);
            if (!result.success) {
                return {
                    success: false,
                    message: `Ошибка rclone: ${result.stderr}`
                };
            }

            const items = result.result.parsed_json || result.result.items || [];
            const totalSize = items.reduce((sum, item) => sum + (item.Size || 0), 0);

            return {
                success: true,
                message: `Успешно подключено. Найдено ${items.length} элементов, общий размер: ${totalSize} байт.`,
                usage: {
                    fileCount: items.length,
                    totalSizeBytes: totalSize
                }
            };
        } catch (e) {
            console.error("❌ Критическая ошибка при проверке соединения:", e.message);
            return { success: false, message: `Ошибка: ${e.message}` };
        }
    }

    /**
     * Упрощённая обёртка для копирования одного файла на Яндекс Диск.
     * @param {string} sourcePath - Локальный путь к файлу.
     * @param {string} targetCategory - Целевая категория для формирования пути назначения.
     * @returns {Promise<void>}
     */
    async copyFile(sourcePath, targetCategory) {
        const destPath = `Migrated/${targetCategory}/${basename(sourcePath)}`;

        Logger.logInfo(`[RcloneManager] Копирование файла: ${sourcePath} → ${destPath}`);

        // Используем существующий метод copyFiles с указанием локальных и удалённых ремоутов
        const result = await this.copyFiles(
            'local:',    // источник — локальная файловая система
            sourcePath,
            this.remoteName, // назначение — настроенное удалённое хранилище (ya:)
            destPath
        );

        if (!result.success) {
            throw new Error(`Failed to copy file: ${result.skippedFiles.join(', ')}`);
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
        // Логируем попытку копирования между разными ремоутами
        if (sourceRemote !== this.remoteName || destRemote !== this.remoteName) {
            Logger.logWarn(
                `[RcloneManager] Копирование между разными ремоутами: ${sourceRemote} → ${destRemote}.`
            );
        }

        console.log(`⚡️ Начинается копирование с ${srcPath} в ${dstPath}`);


        const fullSource = sourceRemote === 'local:' ? srcPath : `${sourceRemote}${srcPath}`;
        const fullDest = destRemote === 'local:' || destRemote === '' ? dstPath : `${destRemote}${dstPath}`;


        const result = await executeRcloneCommand(`rclone copy "${fullSource}" "${fullDest}" --progress`);

        if (result.success) {
            return {
                success: true,
                operationId: Date.now().toString(),
                skippedFiles: []
            };
        } else {
            return {
                success: false,
                operationId: Date.now().toString(),
                skippedFiles: [`Error: ${result.stderr || 'Unknown copy error'}`]
            };
        }
    }
    async getOnlyDuplicateGroups() {
        console.log("🔎 Поиск дубликатов...");

        // Получаем все файлы с их размерами и путями
        const result = await executeRcloneCommand(`rclone lsjson ${this.remoteName} --recursive`);
        if (!result.success) throw new Error(`Ошибка при сканировании: ${result.stderr}`);

        const files = result.result.parsed_json || result.result.items || [];

        // Группируем файлы по размеру
        const sizeGroups = {};
        files.forEach(file => {
            if (file.IsDir) return; // Пропускаем директории
            const size = file.Size;
            if (!sizeGroups[size]) sizeGroups[size] = [];
            sizeGroups[size].push(file);
        });

        // Оставляем только группы с более чем одним файлом (потенциальные дубликаты)
        const duplicateGroups = Object.values(sizeGroups).filter(group => group.length > 1);

        return {
            totalGroups: duplicateGroups.length,
            groups: duplicateGroups,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Генерирует структуру каталогов и обогащает ее метриками.
     * @param {string} rootPath - Корневой путь для анализа.
     * @returns {Promise<{metrics: {count: number, size: number}, tree: object}>} Структурированное дерево каталогов с метриками.
     */
    async getDirectoryTree(rootPath = "") {
        console.log(`🌲 Построение дерева каталогов для ${rootPath || '/'}...`);

        const fullPath = `${this.remoteName}${rootPath}`;
        const result = await executeRcloneCommand(`rclone lsjson "${fullPath}" --recursive`);

        if (!result.success) throw new Error(`Ошибка при построении дерева: ${result.stderr}`);

        const items = result.result.parsed_json || result.result.items || [];

        // Строим иерархию каталогов
        const tree = {};
        const metrics = {
            count: 0,
            size: 0
        };

        items.forEach(item => {
            const pathParts = item.Path.split('/').filter(part => part);
            let currentNode = tree;

            // Проходим по всем частям пути, создавая узлы
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];

                if (!currentNode[part]) {
                    currentNode[part] = {
                        type: i === pathParts.length - 1 && !item.IsDir ? 'file' : 'directory',
                        size: i === pathParts.length - 1 && !item.IsDir ? item.Size : 0,
                        children: {}
                    };
                }

                currentNode = currentNode[part].children;
            }

            // Обновляем метрики
            if (!item.IsDir) {
                metrics.count++;
                metrics.size += item.Size;
            }
        });

        return {
            metrics: metrics,
            tree: tree,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Экспортирует отчёт о дубликатах в файл JSON.
     * @param {object} duplicateGroups - Объект групп дубликатов.
     * @param {Date} timestamp - Временная метка для имени файла.
     * @returns {Promise<{ success: boolean, path: string | null, error: string | null }>} Результат экспорта.
     */
    async exportDuplicateReport(duplicateGroups, timestamp) {
        console.log('⚠️ Экспорт отчёта о дубликатах...');

        try {
            // Создаём директорию для отчётов, если её нет
            await mkdir(REPORTS_DIR, { recursive: true });


            const filename = `duplicates_${timestamp.toISOString().replace(/:/g, '-')}.json`;
            const filepath = join(REPORTS_DIR, filename);

            await writeFile(filepath, JSON.stringify(duplicateGroups, null, 2));

            console.log(`✅ Отчёт сохранён: ${filepath}`);
            return {
                success: true,
                path: filepath,
                error: null
            };
        } catch (error) {
            console.error('❌ Ошибка при сохранении отчёта:', error.message);
            return {
                success: false,
                path: null,
                error: error.message
            };
        }
    }

    /**
     * Экспортирует дерево каталогов в файл JSON.
     * @param {object} directoryMap - Объект дерева каталогов.
     * @param {Date} timestamp - Временная метка для имени файла.
     * @returns {Promise<{ success: boolean, path: string | null, error: string | null }>} Результат экспорта.
     */
    async exportDirectoryTree(directoryMap, timestamp) {
        console.log('🌲 Экспорт дерева каталогов...');

        try {
            await mkdir(REPORTS_DIR, { recursive: true });

            const filename = `directory_tree_${timestamp.toISOString().replace(/:/g, '-')}.json`;
            const filepath = join(REPORTS_DIR, filename);

            await writeFile(filepath, JSON.stringify(directoryMap, null, 2));

            console.log(`✅ Дерево каталогов сохранено: ${filepath}`);
            return {
                success: true,
                path: filepath,
                error: null
            };
        } catch (error) {
            console.error('❌ Ошибка при сохранении дерева каталогов:', error.message);
            return {
                success: false,
                path: null,
                error: error.message
            };
        }
    }

    /**
     * Удаляет файл из облачного хранилища.
     * @param {string} filePath - Путь к файлу для удаления.
     * @returns {Promise<{success: boolean, error: string | null}>} Результат удаления.
     */
    async deleteFile(filePath) {
        console.log(`🗑️ Удаление файла: ${filePath}`);

        const fullPath = `${this.remoteName}${filePath}`;
        const result = await executeRcloneCommand(`rclone delete "${fullPath}"`);

        if (result.success) {
            console.log(`✅ Файл удалён: ${filePath}`);
            return { success: true, error: null };
        } else {
            console.error(`❌ Ошибка при удалении файла ${filePath}: ${result.stderr}`);
            return { success: false, error: result.stderr };
        }
    }

    /**
     * Определяет файлы для сохранения при очистке дубликатов.
     * В реальной реализации может использовать более сложную логику (например, сохранение самого нового файла в группе).
     * @param {object[]} itemsToKeep - Массив объектов файлов, которые нужно сохранить.
     * @returns {Promise<{success: boolean, error: string | null}>} Результат операции.
     */
    async getItemsToKeep(itemsToKeep) {
        console.log('🔎 Определение файлов для сохранения...');

        try {
            // Простая логика: сохраняем первый файл в каждой группе дубликатов
            const filesToKeep = itemsToKeep.map(group => group[0]);

            console.log(`✅ Определено ${filesToKeep.length} файлов для сохранения.`);
            return {
                success: true,
                filesToKeep: filesToKeep,
                error: null
            };
        } catch (error) {
            console.error('❌ Ошибка при определении файлов для сохранения:', error.message);
            return {
                success: false,
                filesToKeep: [],
                error: error.message
            };
        }
    }

    /**
     * Сканирует старые пути e генерирует карты реєстрации и миграции.
     * @param {string[]} oldPaths - Список статых paths.
     * @returns {Promise<{success: boolean, bsRegisterPath: string | null, migrationMapPath: string | null, error: string | null}>} Результаt сканиowania e мапぴng.
     */
    async scanAndMap(oldPaths) {
        console.log('🗺️ Запуск сканиowania e мапぴng puтей...');
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const bsRegisterPath = join(REPORTS_DIR, `bs_register_${timestamp}.csv`);
        const migrationMapPath = join(REPORTS_DIR, `migration_map_${timestamp}.csv`);

        try {
            await mkdir(REPORTS_DIR, { recursive: true });
            let bsRegisterContent = "OldPath,BS_ID,Operator,Region,BS_Name\n";
            let migrationMapContent = "OldPath,NewPath\n";

            for (const path of oldPaths) {
                const filename = basename(path);
                let id = null;
                let name = "Unknown";
                let operator = "Unknown";
                let region = "Unknown";

                // Parsing regex
                const m1 = filename.match(/BS\s*[\-]?(\d{2})-(\d{4,5})_?(.*)/i);
                const m2 = filename.match(/(\d{5}-\w{1}-\d{2,3})/);
                const m3 = filename.match(/(\d{5})_(.*)/);
                const m4 = filename.match(/bs\s*[-\s](\d{4,5})/i);

                if (m1) {
                    id = `${m1[1]}-${m1[2]}`;
                    name = m1[3] || "Unknown";
                } else if (m2) {
                    id = m2[1];
                    name = "Unknown";
                } else if (m3) {
                    id = m3[1];
                    name = m3[2] || "Unknown";
                } else if (m4) {
                    id = m4[1];
                    name = "Unknown";
                } else {
                    const m = filename.match(/\d+/);
                    if (m) id = m[0];
                }

                if (id) {
                    const newDirName = `${id}_${name}`;
                    const newPath = `Базовые_станции/${region}/${operator}/${newDirName}/`;
                    bsRegisterContent += `${path},${id},${operator},${region},${name}\n`;
                    migrationMapContent += `${path},${newPath}\n`;
                }
            }

            await writeFile(bsRegisterPath, bsRegisterContent);
            await writeFile(migrationMapPath, migrationMapContent);

            console.log(`✅ Успешно sгенеriраny CSV: ${bsRegisterPath} i ${migrationMapPath}`);

            return {
                success: true,
                bsRegisterPath,
                migrationMapPath,
                error: null
            };
        } catch (error) {
            console.error('❌ Ошибка при сканиowania e мапぴng:', error.message);
            return {
                success: false,
                bsRegisterPath: null,
                migrationMapPath: null,
                error: error.message
            };
        }
    }

    /**
     * Копирует файлы RRL (Radio Relay Link) между Хостом и Зеркалом.
     * @param {string} hostPath - Путь к файлам на Хосте.
     * @param {string} mirrorPath - Путь к файлам на Зеркале.
     * @returns {Promise<RcloneCopyResult>} Результат копирования.
     */
    async copyRRL(hostPath, mirrorPath) {
        console.log(`🔄 Копирование RRL от Хоста (${hostPath}) к Зеркалу (${mirrorPath})...`);
        
        // Предполагаем, что оба пути находятся в одном и том же удаленном хранилище (this.remoteName)
        const result = await this.copyFiles(
            this.remoteName, // Источник
            hostPath,
            this.remoteName, // Назначение
            mirrorPath
        );
        return result;
    }

    /**
     * Создает текстовый указатель (RRL Link Pointer) в папке Зеркала.
     * @param {string} mirrorPath - Путь к папке Зеркала.
     * @param {string[]} copiedFiles - Массив путей к файлам, скопированным на Зеркало.
     * @returns {Promise<{success: boolean, path: string | null, error: string | null}>} Результат создания указателя.
     */
    async createRrlLinkPointer(mirrorPath, copiedFiles) {
        console.log('🔗 Создание указателя RRL Link Pointer...');

        if (!copiedFiles || copiedFiles.length === 0) {
            console.warn('⚠️ Нет файлов для указателя RRL. Пропуск создания файла.');
            return { success: true, path: null, error: 'No files to list' };
        }

        const pointerContent = copiedFiles.join('\n');
        const timestamp = new Date();
        const filename = `Ссылка_на_пролет_${timestamp.toISOString().replace(/:/g, '-')}.txt`;
        const filepath = join(REPORTS_DIR, filename);

        try {
            await mkdir(REPORTS_DIR, { recursive: true });
            await writeFile(filepath, pointerContent);

            console.log(`✅ Указатель RRL создан: ${filepath}`);
            return {
                success: true,
                path: filepath,
                error: null
            };
        } catch (error) {
            console.error('❌ Ошибка при создании указателя RRL:', error.message);
            return {
                success: false,
                path: null,
                error: error.message
            };
        }
}

module.exports = RcloneManager;