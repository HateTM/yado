/**
 * @file rcloneTools.js
 * @description Core utilities for interacting with cloud storage (Yandex Disk) using rclone.
 * Implements functions for duplicate detection, directory structure mapping, and reporting.
 */

const { execSync } = require('child_process');
const { writeFile, mkdir } = require('fs/promises');
const path = require('path');
const { exec } = require('child_process'); // Import exec for async rclone commands

const REMOTE = 'ya:';
const REPORTS_DIR = 'reports';

/**
 * A structure representing aggregated file metrics for a directory.
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
 * @property {function(): object} getOnlyDuplicateGroups - Scans for duplicate files and returns groups.
 * @property {Promise<{metrics: {count: number, size: number}, tree: object}>} getDirectoryTree - Generates a structured map of directory paths and their aggregated metrics.
 * @property {Promise<{ success: boolean, path: string | null, error: string | null }>} exportDuplicateReport - Saves the duplicate report to a JSON file.
 * @property {Promise<{ success: boolean, path: string | null, error: string | null }>} exportDirectoryTree - Saves the directory tree structure to a JSON file.
 * @property {(filePath: string) => { success: boolean, error: string | null }} deleteFile - Deletes a specific file.
 * @property {(itemsToKeep: {itemsToKeep: string[]}) => {success: boolean, error: string | null}} getItemsToKeep - Determines items to keep based on criteria.
 */

/**
 * @type {rcloneTools}
 */
const rcloneTools = {
  /**
   * Сканирует диск через нативный lsjson и возвращает ТОЛЬКО группы дубликатов.
   * @returns {object} Объект с группами дубликатов.
   */
  getOnlyDuplicateGroups: () => {
    try {
      console.log('⏳ Шаг 1: Сканирование Яндекс Диска и сбор MD5 хэшей...');

      // Исполняем нативный lsjson. Флаг --hash заставляет подтянуть MD5 хэши.
      const output = execSync(
        `rclone lsjson ${REMOTE} -R --files-only --hash`,
        { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 }
      );

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
  async exportDuplicateReport(duplicateGroups, timestamp) {
    return this._exportReport(
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
  async getDirectoryTree(rootPath) {
    console.log(`Generating directory tree starting at: ${rootPath}`);

    try {
      // Получаем все файлы и каталоги рекурсивно
      const command = `rclone lsjson ${REMOTE}${rootPath} -R`;
      console.log(`Executing command: ${command}`);

      const output = await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Rclone command failed: ${stderr}`);
            reject(new Error(stderr || error.message));
            return;
          }
          resolve(stdout);
        });
      });

      const items = JSON.parse(output);
      if (!items || items.length === 0) {
        throw new Error('No directories found or empty rclone output.');
      }

      // Строим дерево и собираем метрики
      const tree = this._buildDirectoryTree(items, rootPath);
      const metrics = this._calculateDirectoryMetrics(items);

      return {
        metrics: metrics,
        tree: tree
      };
    } catch (error) {
      console.error('❌ Ошибка при получении дерева каталогов:', error.message);
      throw error;
    }
  },

  /**
   * Экспортирует отчет о структуре каталогов в файл JSON.
   * @param {object} directoryMap - Объект с картой каталогов.
   * @param {Date} timestamp - Временная метка для имени файла.
   * @returns {Promise<{ success: boolean, path: string | null, error: string | null }>} Результат экспорта.
   */
  async exportDirectoryTree(directoryMap, timestamp) {
    return this._exportReport(
      directoryMap,
      'directory_tree',
      timestamp
    );
  },

  /**
   * Вспомогательная функция для экспорта отчётов (устраняет дублирование кода)
   * @private
   */
  async _exportReport(data, reportType, timestamp) {
    try {
      // Создаем уникальное имя файла
      const timestampString = timestamp.toISOString().replace(/[:.]/g, '-');
      const reportFileName = `${reportType}_${timestampString}.json`;
      const reportFilePath = path.join(REPORTS_DIR, reportFileName);

      // Подготавливаем данные для отчета
      const reportContent = JSON.stringify(data, null, 2);

      // Убеждаемся, что директория reports существует
      await mkdir(REPORTS_DIR, { recursive:       true });


      // Записываем файл
      await writeFile(reportFilePath, reportContent, 'utf-8');

      return { success: true, path: reportFilePath, error: null };
    } catch (error) {
      console.error('❌ Ошибка при экспорте отчета:', error);
      return { success: false, path: null, error: error.message };
    }
  },

  /**
   * Вспомогательная функция для построения дерева каталогов из списка файлов
   * @private
   */
  _buildDirectoryTree(items, rootPath) {
    const root = {
      path: rootPath,
      name: path.basename(rootPath),
      children: []
    };

    // Группируем элементы по родительским директориям
    const dirMap = new Map();
    dirMap.set(rootPath, root);

    items.forEach(item => {
      const itemPath = item.Path;
      const parentPath = path.dirname(itemPath);

      if (!dirMap.has(parentPath)) {
        const parentName = path.basename(parentPath);
        dirMap.set(parentPath, {
          path: parentPath,
          name: parentName,
          children: []
        });
      }

      const parent = dirMap.get(parentPath);
      if (parent && !parent.children.some(child => child.path === itemPath)) {
        parent.children.push({
          path: itemPath,
          name: item.Name,
          isFile: !item.IsDir,
          size: item.Size || 0,
          modTime: item.ModTime
        });
      }
    });

    return root;
  },

  /**
   * Вспомогательная функция для расчёта метрик каталога
   * @private
   */
  _calculateDirectoryMetrics(items) {
    let fileCount = 0;
    let totalSize = 0;

    items.forEach(item => {
      if (!item.IsDir) {
        fileCount++;
        totalSize += item.Size || 0;
      }
    });

    return {
      count: fileCount,
      size: totalSize
    };
  },

  /**
   * Удаляет файл из облачного хранилища
   * @param {string} filePath - Полный путь к файлу на облаке
   * @returns {{ success: boolean, error: string | null }} Результат удаления
   */
  deleteFile(filePath) {
    try {
      execSync(`rclone delete ${REMOTE}${filePath}`);
      console.log(`✅ Файл удалён: ${filePath}`);
      return { success: true, error: null };
    } catch (error) {
      console.error(`❌ Ошибка при удалении файла ${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Определяет файлы для сохранения в группах дубликатов (оставляет самый новый/самый большой)
   * @param {object} duplicateGroups - Группы дубликатов из getOnlyDuplicateGroups
   * @returns {{itemsToKeep: string[], success: boolean, error: string | null}} Список файлов для сохранения
   */
  getItemsToKeep(duplicateGroups) {
    const itemsToKeep = [];

    try {
      Object.values(duplicateGroups).forEach(group => {
        // Оставляем файл с самой поздней датой изменения
        const keepItem = group.reduce((latest, current) => {
          return new Date(current.ModTime) > new Date(latest.ModTime) ? current : latest;
        });
        itemsToKeep.push(keepItem.Path);
      });

      return { itemsToKeep, success: true, error: null };
    } catch (error) {
      console.error('❌ Ошибка при определении файлов для сохранения:', error.message);
      return { itemsToKeep: [], success: false, error: error.message };
    }
  }
};