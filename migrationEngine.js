// migrationEngine.js

/**
 * Класс-движок для обработки каталогов, парсинга идентификаторов БС,
 * определения целевых структур и генерации плана миграции.
 * 
 * @module migrationEngine
 */

/**
 * Карта регулярных выражений для извлечения старых форматов ID.
 * Ключ: описательный комментарий. Значение: RegExp.
 * Регулярные выражения должны быть максимально широкими, но точными.
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
 * Основная структура для реестра UID.
 * Maps: UID -> { old_paths: [path1, path2], first_found: timestamp }
 */
const bsRegister = new Map();

/**
 * Карта ключевых слов для определения категории подкаталога.
 * Приоритет: 01 -> 02 -> 03 -> 05 -> 08
 * 
 * ПРИМЕЧАНИЕ: Ключи заданы как строки для предотвращения интерпретации как восьмеричных литералов, 
 * что устраняет [ts Error] Line 38: Восьмеричные литералы не допускаются.
 * Использование строковых ключей также устраняет возможные проблемы с ожидаемым двоеточием.
 */
const CATEGORY_KEYWORDS = {
    "01_survey_pir": ['ПИР', 'Обследование'],
    "02_design": ['Проектирование', 'КМ', 'РНС'],
    "03_construction": ['Стройка', 'Монтаж', 'Исполнительная документация'],
    "05_maintenance_to": ['ТО', 'Техническое обслуживание', 'Замеры'],
    "08_archive": []
};


/**
 * Пытается извлечь стандартизированный UID из предоставленного пути/имени.
 * @param {string} filePath - Старый полный путь или имя файла.
 * @returns {string | null} Стандартизированный UID в формате BS-<КодРегиона>-<УникальныйНомер> или null.
 */
function extractAndStandardizeUid(filePath) {
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
                uniqueNumber = match[1].replace(/[^0-9]/g, ''); // Удаляем не-цифры
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
        // Используем 2-значный код региона (37, 49, 28 и т.д.)
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
function determineCategory(folderName) {
    const normalizedName = folderName.trim();
    for (const categoryCode in CATEGORY_KEYWORDS) {
        const keywords = CATEGORY_KEYWORDS[categoryCode];
        if (keywords.some(keyword => normalizedName.includes(keyword))) {
            return categoryCode;
        }
    }
    return '08_archive'; // По умолчанию
}


/**
 * Вспомогательная функция для обработки списка файлов и построения реестра UID и сырого плана миграции.
 * @param {Array<{path: string, modTime: string, fullPath: string}>} fileList - Массив объектов, представляющих файлы/папки для обработки.
 * @returns {{registration: Object, plan: Array<Object>}} Объект с реестром UID и сырым планом миграции.
 */
function processFilelistForPlan(fileList) {
    const bsRegistry = new Map();
    
    // 1. Построение Реестра БС
    fileList.forEach(item => {
        const uid = extractAndStandardizeUid(item.fullPath);
        if (uid) {
            if (!bsRegistry.has(uid)) {
                bsRegistry.set(uid, {
                    old_paths: [],
                    first_found: item.modTime
                });
            }
            bsRegistry.get(uid).old_paths.push(item.fullPath);
        }
    });

    const bsRegistryObject = {};
    bsRegistry.forEach((data, uid) => {
        bsRegistryObject[uid] = {
            old_paths: data.old_paths,
            first_found: data.first_found
        };
    });

    // 2. Построение сырого Плана Миграции
    const rawMigrationPlan = [];

    fileList.forEach(item => {
        // Определяем UID и категорию для этого файла
        const uid = extractAndStandardizeUid(item.fullPath);
        const category = determineCategory(item.path.split('/').pop() || item.path);

        if (uid) {
            // Формирование нового имени файла
            const datePart = item.modTime.substring(0, 10).replace(/-/g, '-'); // YYYY-MM-DD
            const fileNameTemplate = `${datePart}_${uid}_${category}_v1.${item.path.split('.').pop()}`;

            rawMigrationPlan.push({
                sourcePath: item.fullPath,
                targetStructure: `Base_Stations/REGION_${uid.split('-')[1]}/${uid}_${category}/`,
                newFileName: fileNameTemplate,
                fullNewTargetPath: `${targetStructure}${fileNameTemplate}`
            });
        }
    });

    return {
        registration: bsRegistryObject,
        rawPlan: rawMigrationPlan
    };
}

/**
 * Вспомогательная функция для сборки финальной структуры плана миграции.
 * @param {{registration: Object, rawPlan: Array<Object>}} processedData - Результат processFilelistForPlan.
 * @returns {{metadata: Object, files: Array<Object>}} Финальный объект плана миграции.
 */
function assembleMigrationPlan(processedData) {
    const { registration, rawPlan } = processedData;

    const plan = {
        metadata: {
            run_date: new Date().toISOString()
        },
        files: rawPlan
    };
    return plan;
}


/**
 * Главная функция, запускающая процесс миграционного планирования.
 * @param {Array<{path: string, modTime: string, fullPath: string}>} fileList - Массив объектов, представляющих файлы/папки для обработки.
 * @returns {{registration: Object, plan: Array<Object>}} Объект с реестром UID и планом миграции.
 */
function runPlan(fileList) {
    console.log("--- Starting Migration Plan ---");

    // 1. Преобразование и построение сырых данных
    const processedData = processFilelistForPlan(fileList);

    // 2. Сборка финального плана
    const finalPlan = assembleMigrationPlan(processedData);
    
    return {
        registration: processedData.registration,
        plan: finalPlan.files
    };
}


// Export function for usage
module.exports = {
    runPlan: (files) => {
        return runPlan(files);
    }
};
