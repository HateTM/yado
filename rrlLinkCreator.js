/**
 * @file rrlLinkCreator.js
 * @description Модуль для создания RRL Link Pointer файлов.
 * Генерирует метаданные и контент для указателей RRL.
 */

const { join, dirname } = require('path');
const fs = require('fs');
const path = require('path');

/**
 * Генерирует метаданные для RRL ссылки.
 * Создает JSON-объект с информацией о скопированных файлах.
 * 
 * @param {Array<string>} copiedFiles - Массив путей к файлам, которые были скопированы
 * @param {string} sourceRemote - Имя rclone источника
 * @param {string} targetRemote - Имя rclone назначения
 * @param {string} timestamp - Временная метка для имени файла
 * @returns {object} Объект с метаданными RRL ссылки
 */
function generateLinkMetadata(copiedFiles, sourceRemote = 'ya:', targetRemote = 'ya:', timestamp) {
    // Форматируем timestamp для имени файла
    const safeTimestamp = timestamp ? timestamp.replace(/:/g, '-') : new Date().toISOString().replace(/:/g, '-');
    
    // Форматируем пути - удаляем префикс remote если есть
    const normalizedFiles = copiedFiles.map(filePath => {
        let cleanPath = filePath;
        if (filePath.startsWith(sourceRemote)) {
            cleanPath = filePath.replace(sourceRemote, '');
        }
        if (filePath.startsWith(targetRemote)) {
            cleanPath = filePath.replace(targetRemote, '');
        }
        return cleanPath;
    });

    const metadata = {
        operationType: 'rrl_link_pointer',
        timestamp: timestamp || new Date().toISOString(),
        sourceRemote: sourceRemote,
        targetRemote: targetRemote,
        sourcePath: sourceRemote === 'ya:' ? 'host' : sourceRemote,
        targetPath: targetRemote === 'ya:' ? 'mirror' : targetRemote,
        fileCount: copiedFiles.length,
        totalSizeBytes: copiedFiles.reduce((sum, file) => {
            // Имитация получения размера - в реальной реализации нужно сканировать
            return sum; // будет заполнено при необходимости
        }, 0),
        files: normalizedFiles,
        checksums: {},
        metadataVersion: '1.0'
    };

    return metadata;
}

/**
 * Форматирует контент для текстового указателя RRL.
 * Создает человеко-читаемый список скопированных файлов.
 * 
 * @param {Array<string>} copiedFiles - Массив путей к файлам
 * @param {object} metadata - Метаданные (опционально)
 * @param {string} format - Формат вывода ('text', 'json', 'csv')
 * @returns {string} Форматированный контент
 */
function formatLinkContent(copiedFiles, metadata = null, format = 'text') {
    switch (format) {
        case 'json':
            return JSON.stringify(generateLinkMetadata(copiedFiles), null, 2);
        
        case 'csv':
            const csvRows = ['Source Path,Target Path,Size (bytes),Last Modified,Checksum']
                .concat(copiedFiles.map(file => {
                    const parts = file.split('/');
                    const dateMatch = parts.find(p => /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(p));
                    const sizeMatch = parts.find(p => /^[0-9]{1,3}(B|MB)?$/.test(p)) || 'N/A';
                    return `${file},Migrated/${file},N/A,${dateMatch || 'N/A'},N/A`;
                }));
            return csvRows.join('\n');
        
        case 'text':
        default:
            // Генерируем человеко-читаемый текстовый формат
            const header = generateLinkMetadata(copiedFiles, 'ya:', 'ya:');
            
            const content = [];
            content.push('='.repeat(60));
            content.push('RRL LINK POINTER');
            content.push('='.repeat(60));
            content.push(`Generated: ${header.timestamp}`);
            content.push(`Files listed: ${header.fileCount}`);
            content.push('='.repeat(60));
            content.push('');
            content.push('Copied Files:');
            content.push(''.repeat(60));
            
            copiedFiles.forEach((file, index) => {
                const parts = file.split('/');
                const datePart = parts.find(p => /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(p));
                content.push(`${index + 1}. ${file}`);
                if (datePart) {
                    content.push(`   First found: ${datePart}`);
                }
            });
            
            content.push(''.repeat(60));
            content.push('');
            content.push('This file contains a list of RRL files that have been');
            content.push('copied from the Host to the Mirror repository.');
            content.push('');
            content.push('Last updated: ' + new Date().toLocaleString('ru-RU'));
            content.push('='.repeat(60));
            
            return content.join('\n');
    }
}

/**
 * Создает RRL Link Pointer файл в целевой директории.
 * 
 * @param {Array<string>} copiedFiles - Массив скопированных файлов
 * @param {string} targetDir - Директория для сохранения файла
 * @param {object} options - Опции (format, includeMetadata)
 * @returns {Promise<object>} Результат операции
 */
async function createRrlLinkPointer(copiedFiles, targetDir, options = {}) {
    const {
        format = 'text',
        includeMetadata = false,
        reportDir = join(__dirname, '..', 'reports')
    } = options;

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `Ссылка_на_пролет_${timestamp}.txt`;
    const filepath = join(reportDir, filename);

    try {
        // Генерируем контент
        const content = formatLinkContent(copiedFiles, null, format);
        
        // Если требуется JSON формат с метаданными
        if (format === 'json' && includeMetadata) {
            const metadata = generateLinkMetadata(copiedFiles);
            // Добавляем пути к файлам в метаданные
            metadata.files = copiedFiles.map(file => file.replace(/ya:|\/|\\|local:/g, ''));
            await fs.promises.mkdir(reportDir, { recursive: true });
            await fs.promises.writeFile(filepath, JSON.stringify(metadata, null, 2), 'utf8');
        } else {
            await fs.promises.mkdir(reportDir, { recursive: true });
            await fs.promises.writeFile(filepath, content, 'utf8');
        }

        return {
            success: true,
            path: filepath,
            filename: filename,
            format: format,
            fileCount: copiedFiles.length
        };
    } catch (error) {
        console.error('Ошибка при создании RRL Link Pointer:', error.message);
        return {
            success: false,
            path: null,
            error: error.message
        };
    }
}

module.exports = {
    generateLinkMetadata,
    formatLinkContent,
    createRrlLinkPointer
};