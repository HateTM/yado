/**
 * @file rcloneTools.js
 * @description Core utilities for interacting with cloud storage (Yandex Disk) using rclone.
 * Implements functions for duplicate detection, directory structure mapping, and reporting.
 * 
 * NOTE: All public methods must be called in an async context.
 */

import { exec } from 'child_process';
import { promisify } from 'util'; // Use ES Module import syntax
// Wrapper for exec to ensure reliable promise-based execution
const execAsync = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};
//>>>>
// <task_progress>
//- [x] Analyze requirements
//- [x] Set up necessary files (Updated rcloneTools.js - Fixed execAsync wrapper)
//- [ ] Implement and test core synchronization logic (Next: Write and run tests for `copyDirectory`)
//- [ ] Verify results (Final test run and confirmation)
//</task_progress>

import { writeFile, mkdir } from 'fs/promises';
import { join, basename, dirname } from 'path';

// --- Константы ---
const REMOTE = 'ya:';
const REPORTS_DIR = 'reports';

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
 * @typedef {object} rcloneTools
 * @property {() => Promise<object>} getOnlyDuplicateGroups - Сканирует дубликаты и возвращает группы.
 * @property {() => Promise<{metrics: {count: number, size: number}, tree: object}>} getDirectoryTree - Генерирует структуру каталогов с метриками.
 * @property {(duplicateGroups: object, timestamp: Date) => Promise<{ success: boolean, path: string | null, error: string | null }>} exportDuplicateReport - Сохраняет отчет о дубликатах.
 * @property {(directoryMap: object, timestamp: Date) => Promise<{ success: boolean, path: string | null, error: string | null }>} exportDirectoryTree - Сохраняет дерево каталогов.
 * @property {(filePath: string) => Promise<{ success: boolean, error: string | null }>} deleteFile - Удаляет файл.
 * @property {(sourcePath: string, destPath: string) => Promise<{success: boolean, error: string | null}>} copyDirectory - Копирует папку или файл.
 * @property {(itemsToKeep: {itemsToKeep: string[]}) => Promise<{success: boolean, error: string | null}>} getItemsToKeep - Определяет файлы для сохранения.
 */

/**
 * @type {rcloneTools}
 */
export const rcloneTools = {
  /**
   * Сканирует диск через нативный lsjson и асинхронно возвращает ТОЛЬКО группы дубликатов.
   * @returns {Promise<object>} Объект с группами дубликатов.
   */
  getOnlyDuplicateGroups: async () => {
    console.log('⏳ Шаг 1: Сканирование Яндекс Диска и сбор MD5 хэшей...');

    try {
      // Используем execAsync для асинхронного выполнения и обработки таймаута
      const command = `rclone lsjson ${REMOTE} -R --files-only --hash`;
      console.log(`Executing command: ${command}`);

      const { stdout, stderr } = await execAsync(command, { timeout: 300000 });

      if (stderr) {
        console.error('❌ Ошибка rclone:', stderr);
        return {};
      }

      const output = stdout;

      const allFiles = JSON.parse(output || '[]');
      const hashMap = {};

      allFiles.forEach(file => {
        // У lsjson объект хэшей находится в поле "Hashes", а MD5 пишется маленькими буквами
        if (file.Size > 0 && file.Hashes && file.Hashes.md5) {
          const hash = file.Hashes.md5;
          if (!hashMap[hash]) {
            hashMap[hash] = [];
          }
          hashMap[hash].push({
            Path: file.Path,
            Name: file.Name,
            Size: file.Size,
            ModTime: file.ModTime
          });
        }
      });

      const duplicateGroups = {};
      let counter = 0;

      Object.keys(hashMap).forEach(hash => {
        if (hashMap[hash].length > 1) {
          duplicateGroups[hash] = hashMap[hash];
          counter += (hashMap[hash].length - 1);
        }
      });

      console.log(`📊 Анализ завершен. Найдено групп дубликатов: ${Object.keys(duplicateGroups).length}. Лишних файлов: ${counter}`);
      return duplicateGroups;
    } catch (error) {
      console.error('❌ Ошибка при сканировании и фильтрации:', error.message);
      return {};
    }
  },

  /**
   * Экспортирует отчет о дубликатах в файл JSON.
   * @param {object} duplicateGroups - Объект групп дубликатов.
   * @param {Date} timestamp - Временная метка для имени файла.
   * @returns {Promise<{ success: boolean, path: string | null, error: string | null }>} Результат экспорта.
   */
  exportDuplicateReport: async (duplicateGroups, timestamp) => {
    return rcloneTools._exportReport(
      duplicateGroups,
      'duplicates',
      timestamp
    );
  },


  /**
   * Генерирует структуру каталогов и обогащает ее метриками.
   * @param {string} rootPath - Корневой путь для анализа.
   * @returns {Promise<{metrics: {count: number, size: number}, tree: object}>} - Структурированное дерево каталогов с метриками.
   */
  getDirectoryTree: async (rootPath) => {
    console.log(`Generating directory tree starting at: ${rootPath}`);

    try {
      // Получаем все файлы и каталоги рекурсивно
      const command = `rclone lsjson ${REMOTE}${rootPath} -R`;
      console.log(`Executing command: ${command}`);

      // Используем асинхронную команду
      const { stdout, stderr } = await execAsync(command, { timeout: 300000 });

      if (stderr) {
        console.error('❌ Ошибка rclone:', stderr);
        throw new Error(stderr);
      }

      const items = JSON.parse(stdout);
      if (!items || items.length === 0) {
        throw new Error('No directories found or empty rclone output.');
      }

      // Строим дерево и собираем метрики
      const tree = rcloneTools._buildDirectoryTree(items, rootPath);
      const metrics = rcloneTools._calculateDirectoryMetrics(items);

      return {
        metrics: metrics,
        tree: tree
      };
    } catch (error) {
      console.error('❌ Ошибка при получении дерева каталогов:', error.message);
      throw error;
    }
  },


  exportDirectoryTree: async (directoryMap, timestamp) => {
    return rcloneTools._exportReport(
      directoryMap,
      'directory_tree',
      timestamp
    );

  },

    async _exportReport(data, reportType, timestamp) {
    try {
      // 1. Создание имени и пути файла
      const timestampString = timestamp.toISOString().replace(/[:\.]/g, '-');
      const reportFileName = `${reportType}_${timestampString}.json`;
      const reportFilePath = join(REPORTS_DIR, reportFileName);

      // 2. Подготовка контента
      // Используем JSON.stringify с отступами в 2 пробела для читаемости
      const reportContent = JSON.stringify(data, null, 2);

      // 3. Гарантия существования директории reports
      await mkdir(REPORTS_DIR, { recursive: true });

      // 4. Запись файла
      await writeFile(reportFilePath, reportContent, 'utf-8');

      return { success: true, path: reportFilePath, error: null };
    } catch (error) {
      // Возвращаем более подробную информацию об ошибке
      console.error(`❌ Ошибка при экспорте отчета (${reportType}):`, error.message);
      return { success: false, path: null, error: `Не удалось экспортировать отчет: ${error.message}` };
    }
  },

  _buildDirectoryTree(items, rootPath) {
    const root = {
      path: rootPath,
      name: basename(rootPath),
      children: []
    };

    // Используем Map для эффективного поиска родительских каталогов
    const dirMap = new Map();
    dirMap.set(rootPath, root);

    for (const item of items) {
      const itemPath = item.Path;
      const parentPath = dirname(itemPath);

      if (!dirMap.has(parentPath)) {
        const parentName = basename(parentPath);
        dirMap.set(parentPath, {
          path: parentPath,
          name: parentName,
          children: []
        });
      }

      const parent = dirMap.get(parentPath);
      // Проверка, чтобы не добавлять элемент дважды, если он уже добавлен в более крупном контексте
      if (parent && !parent.children.some(child => child.path === itemPath)) {
        parent.children.push({
          path: itemPath,
          name: item.Name,
          isFile: !item.IsDir,
          size: item.Size || 0,
          modTime: item.ModTime
        });
      }
    }

    return root;
  },

  /**
   * Вспомогательная функция для расчёта метрик каталога
   * @private
   * @param {Array < object >} items - Список JSON-объектов из rclone lsjson.
    * @returns {DirectoryMetrics} Метрики.
    */
  _calculateDirectoryMetrics(items) {
    let fileCount = 0;
    let totalSize = 0;

    for (const item of items) {
      if (!item.IsDir) {
        fileCount++;
        totalSize += item.Size || 0;
      }
    }

    return {
      count: fileCount,
      size: totalSize
    };
  },

  /**
   * Удаляет файл из облачного хранилища (Асинхронно).
   * @param {string} filePath - Полный путь к файлу на облаке.
    * @returns {Promise < { success: boolean, error: string | null } >} Результат удаления.
    */
  deleteFile: async (filePath) => {
    try {
      const command = `rclone delete ${REMOTE}${filePath}`;
      console.log(`Attempting to delete file: ${filePath}`);

      // Используем execAsync и ждем результата
      await execAsync(command, { timeout: 300000 });

      console.log(`✅ Файл удалён: ${filePath}`);
      return { success: true, error: null };
    } catch (error) {
      console.error(`❌ Ошибка при удалении файла ${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Копирует содержимое одного каталога (или файла) из источника в назначение.
   * @param {string} sourcePath - Полный путь к источнику на облаке (e.g., yandex:source/path).
   * @param {string} destPath - Полный путь к назначению на облаке (e.g., yandex:dest/path).
   * @returns {Promise<{success: boolean, error: string | null}>} Результат копирования.
   */
  copyDirectory: async (sourcePath, destPath) => {
    console.log(`⚡️ Начинается копирование с ${sourcePath} в ${destPath}`);
    
    // rclone copy: выполняет копирование, не удаляет ничего из назначения
    const command = `rclone copy ${REMOTE}${sourcePath} ${REMOTE}${destPath}`;
    console.log(`Executing command: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 300000 });

      if (stderr) {
        console.error('❌ Ошибка rclone:', stderr);
        return { success: false, error: stderr };
      }

      console.log(`✅ Копирование завершено. Стаутд: ${stdout}`);
      return { success: true, error: null };
    } catch (error) {
      console.error(`❌ Критическая ошибка при копировании:`, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Определяет файлы для сохранения в группах дубликатов (оставляет самый новый/самый большой)
   * @param {object} duplicateGroups - Группы дубликатов из getOnlyDuplicateGroups.
   * @returns {Promise < { itemsToKeep: string[], success: boolean, error: string | null } >} Список файлов для сохранения.
   */
  getItemsToKeep: async (duplicateGroups) => {
//>//>>>
//<//task_progress>
//- //[x] Analyze requirements
//- [x] Set up necessary files (Added copyDirectory function and updated rcloneTools.js)
//- [ ] Implement and test core synchronization logic (Next: Implement and run tests for `copyDirectory`)
//- [ ] Verify results (Final test run and confirmation)
//</task_progress>
    const itemsToKeep = [];

    try {
      for (const hash of Object.values(duplicateGroups)) {
        // Оставляем файл с самой поздней датой изменения
        const keepItem = hash.reduce((latest, current) => {
          // Сравниваем даты. Предполагаем, что ModTime является валидной строкой даты.
          return new Date(current.ModTime) > new Date(latest.ModTime) ? current : latest;
        });
        itemsToKeep.push(keepItem.Path);
      }

      return { itemsToKeep, success: true, error: null };
    } catch (error) {
      console.error('❌ Ошибка при определении файлов для сохранения:', error.message);
      return { itemsToKeep: [], success: false, error: error.message };
    }
  }
};
