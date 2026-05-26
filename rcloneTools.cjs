const { execSync } = require('child_process');
const { promises: fs } = require('fs');
const { join, dirname, relative } = require('path');

// Регистр для хранения всех БС
const baseStationsRegistry = new Map();

/**
 * Выделяет числовую часть из строки идентификатора БС
 * @param {string} rawId - Сырой идентификатор (например, "23275_Копнинское", "BS 37-2971", "бс -19075")
 * @returns {number} Числовая часть для числового сравнения
 */
function getNumericId(rawId) {
    const match = String(rawId).trim().match(/\d+/);
    return match ? parseInt(match, 10) : 0;
}

/**
 * Извлекает ID БС из старого пути с помощью RegEx
 * @param {string} oldPath - Старый путь к папке БС
 * @returns {string|number|null} ID БС или null если не найдено
 */
function extractBsIdFromPath(oldPath) {
    // Варианты форматов ID:
    // "BS 37-2971_", "49986-P-76", "2971", "бс-19075", "23275_Копнинское"
    const patterns = [
        /(?<=_BS_|_BS_)[0-9]+/g,              // _BS_2971
        /(?<=_)[0-9]+(?= _|$)/g,              // после _ перед _ или концом строки
        /[0-9]{5,}/g,                         // 5+ цифр подряд
        /-[0-9]+/g,                           // после дефиса
        /(?<![_0-9])[0-9]+(?![0-9_])/g,      // изолированные цифры
    ];

    // Широкое извлечение: ищем любые последовательности цифр
    const matches = oldPath.match(/[\d]+/g);
    
    if (matches && matches.length > 0) {
        // Если нашли длинный ID (5+ цифр) - это основной ID БС
        const longId = matches.find(m => m.length >= 5);
        if (longId) {
            return longId;
        }
        
        // Иначе берём первый найденный ID (исключаем короткие номера, например "37")
        const candidate = matches.find(m => parseInt(m) > 100);
        if (candidate) {
            return candidate;
        }
    }
    
    return null;
}

/**
 * Извлекает операторов и регионы из пути
 * @param {string} oldPath - Старый путь
 * @returns {Object} Объект с region и operator
 */
function extractRegionAndOperator(oldPath) {
    // Извлекаем регион (обычно первый компонент после корневого пути)
    const pathParts = oldPath.split(/[\\/]/);
    
    let region = 'Неизвестный_регион';
    let operator = 'Неизвестный_оператор';
    
    // Пытаемся извлечь из названия БС
    const bsPath = pathParts.find(p => /^[0-9-_]+[^\s]+$/.test(p)) || 
                    pathParts.find(p => /^[0-9]+/.test(p));
    
    if (bsPath) {
        // Оператор часто в названии БС или в компоненте до него
        const operatorPatterns = ['Мегафон', 'МТС', 'Билайн', 'Ростелеком', 'Транстелеком', 'Siberian Telecom'];
        const operator = operatorPatterns.find(op => oldPath.includes(op));
        
        // Регион - это компонент перед оператором
        const regionIndex = pathParts.indexOf(operator) > 0 ? 
            pathParts.indexOf(operator) - 1 : 
            pathParts.findIndex((p, i) => i < pathParts.indexOf(operator) && 
                /[\d-]+/.test(p));
        region = pathParts[regionIndex] || 'Центральный';
    }
    
    return { region, operator };
}

/**
 * Генерирует новый путь в облаке по стандартам
 * @param {string} bsId - Чистый ID БС
 * @param {string} bsName - Название БС
 * @param {string} region - Регион
 * @param {string} operator - Оператор
 * @returns {string} Новый путь в формате: Базовые_станции/[Регион]/[Оператор]/[ID]_[Название]
 */
function generateNewCloudPath(bsId, bsName, region, operator) {
    // Очистка имени БС от спецсимволов для каталога
    const sanitizedBsName = bsName
        .replace(/[_\-]/g, '_')
        .replace(/[\/\\":*?<>|]/g, '_');
    
    return `Базовые_станции/${region}/${operator}/${bsId}_${sanitizedBsName}`;
}

/**
 * Обходит локальную папку с архивами и строит реестр БС
 * @param {string} archivePath - Путь к папке с архивами
 * @returns {Promise<Array>} Массив записей о найденных БС
 */
async function scanLocalArchives(archivePath) {
    console.log(`[SCAN] Начало сканирования: ${archivePath}`);
    
    const results = [];
    
    try {
        // Проверка, существует ли папка
        await fs.access(archivePath);
        
        // Чтение директории
        const files = await fs.readdir(archivePath, { withFileTypes: true });
        
        for (const file of files) {
            const fullPath = join(archivePath, file.name);
            
            // Проверяем только директории
            if (!file.isDirectory()) continue;
            
            // Проверяем, содержит ли путь имя БС
            const oldPath = fullPath;
            const bsId = extractBsIdFromPath(oldPath);
            
            if (!bsId) continue;
            
            // Извлекаем регион и оператора
            const { region, operator } = extractRegionAndOperator(oldPath);
            
            // Если уже есть запис, добавляем информацию к существующей
            if (baseStationsRegistry.has(bsId)) {
                const existing = baseStationsRegistry.get(bsId);
                existing.regions.push(region);
                existing.operators.push(operator);
            } else {
                // Новая БС
                baseStationsRegistry.set(bsId, {
                    bsId: bsId,
                    bsName: file.name.replace(new RegExp(`^${bsId}|_?${bsId}$`), ''),
                    region,
                    operator,
                    oldPath
                });
            }
        }
        
        // Конвертируем Map в массив для CSV
        return Array.from(baseStationsRegistry.values());
        
    } catch (error) {
        console.error(`[SCAN] Ошибка при сканировании: ${error.message}`);
        return [];
    }
}

/**
 * Генерирует CSV файл реестра БС
 * @param {Array} bsList - Массив записей о БС
 * @param {string} outputPath - Путь для вывода CSV
 */
function generateBsRegisterCSV(bsList, outputPath) {
    const headers = ['Region', 'Operator', 'BS_ID', 'BS_Name', 'Old_Path'];
    const rows = bsList.map(bs => 
        `${bs.region},${bs.operator},${bs.bsId},${bs.bsName},${bs.oldPath}`
    );
    
    const csvContent = [
        headers.join(','),
        ...rows
    ].join('\n');
    
    await fs.writeFile(outputPath, csvContent, 'utf-8');
    console.log(`[CSV] Реестр БС сохранён: ${outputPath}`);
    return outputPath;
}

/**
 * Генерирует карту миграции (сопоставление Old_Path -> New_Cloud_Path)
 * @param {Array} bsList - Массив записей о БС
 * @param {string} outputPath - Путь для вывода CSV
 */
function generateMigrationMapCSV(bsList, outputPath) {
    const rows = bsList.map(bs => {
        const { region, operator, bsId, bsName } = bs;
        const newCloudPath = generateNewCloudPath(bsId, bsName, region, operator);
        return `${bs.oldPath},${newCloudPath}`;
    });
    
    const csvContent = [
        'Old_Path,New_Cloud_Path',
        ...rows
    ].join('\n');
    
    await fs.writeFile(outputPath, csvContent, 'utf-8');
    console.log(`[CSV] Карта миграции сохранена: ${outputPath}`);
    return outputPath;
}

/**
 * Выполняет команду rclone
 * @param {string} command - Команда rclone
 * @returns {Promise<{stdout: string, stderr: string, status: number}>}
 */
async function executeRcloneCommand(command) {
    try {
        const output = execSync(command, { 
            encoding: 'utf-8',
            env: { ...process.env },
            cwd: process.cwd()
        });
        return { stdout: output, stderr: '', status: 0 };
    } catch (error) {
        return {
            stdout: '',
            stderr: error.stderr || error.message,
            status: error.status || 1
        };
    }
}

/**
 * Обработчик команды --scan
 * @param {string} args - Аргументы команды
 */
async function handleScan(args) {
    const archivePath = args.find(arg => arg.startsWith('--scan='))?.split('=')[1] || args.find(arg => arg.startsWith('--scan ')).split(' ')[1];
    
    if (!archivePath) {
        console.error('[ERROR] Укажите путь к архивам через --scan=/путь/к/архивам');
        console.log('Пример: node rcloneTools.cjs --scan=C:\\Archives\\BS');
        return null;
    }
    
    // Конвертируем в Unix-формат для rclone
    const unixPath = archivePath.replace(/\\/g, '/');
    
    // Сканируем локальные архивы
    const bsList = await scanLocalArchives(unixPath);
    
    if (bsList.length === 0) {
        console.error('[SCAN] Базовые станции не найдены');
        return [];
    }
    
    // Генерируем CSV файлы
    const registerPath = 'bs_register.csv';
    const migrationMapPath = 'migration_map.csv';
    
    const registerPathFull = await generateBsRegisterCSV(bsList, registerPath);
    const migrationMapPathFull = await generateMigrationMapCSV(bsList, migrationMapPath);
    
    // Показываем реестр
    console.log('\n=== РЕЕСТР БАЗОВЫХ СТАЦИЙ ===');
    console.log(bsList.map(bs => 
        `${bs.bsId.padEnd(8)} | ${bs.region.padEnd(20)} | ${bs.operator.padEnd(15)} | ${bs.bsName}`
    ).join('\n'));
    
    return { registerPathFull, migrationMapPathFull };
}

// Экспортируем функции
module.exports = {
    getNumericId,
    extractBsIdFromPath,
    extractRegionAndOperator,
    generateNewCloudPath,
    handleScan,
    executeRcloneCommand,
    scanLocalArchives,
    generateBsRegisterCSV,
    generateMigrationMapCSV
};