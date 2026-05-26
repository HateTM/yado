/**
 * src/api/ollamaClient.js
 *
 * Мокированный клиент для взаимодействия с Ollama.
 * Реализует логику гибридной классификации метаданных файла
 * с использованием LLM для определения новой категории и имени.
 *
 * ПОМНИТЕ: В реальной системе эта функция должна асинхронно
 * вызывать Ollama API, используя 'contentSummary' и 'fullPath'
 * для получения решения LLM.
 *
 * @module OllamaClient
 */

/**
 * Мокирует асинхронный вызов LLM для классификации файла.
 * @param {object} metadata - Метаданные файла, содержащие информацию для анализа.
 * @returns {Promise<{finalCategory: string, suggestedNewName: string, classification: object}>} Результат классификации от LLM.
 * @throws {Error} Ошибка, если соединение с LLM не удалось.
 */
async function classifyFileWithOllama(metadata) {
    console.log(`[LLM Client] Analyzing file: ${metadata.fullPath}...`);

    // --- ИМИТАЦИЯ ВЫЗОВА LLM ---
    // В реальном коде здесь должен быть:
    // const response = await ollama.generate({
    //     model: 'llama3',
    //     prompt: `Классифицируй файл по содержимому и пути. Категория должна быть из списка '01', '02', '03'. 
    //             Данные: Путь=${metadata.fullPath}, Контент='${metadata.contentSummary}'`,
    // });
    // const classificationResult = JSON.parse(response.response);
    // -----------------------------

    await new Promise(resolve => setTimeout(resolve, 150)); // Симуляция задержки сети/вычислений

    // Реализация логики:
    let finalCategory = '02';
    let suggestedNewName = '';
    let classification = {};

    const summary = metadata.contentSummary.toLowerCase();
    const fullPath = metadata.fullPath.toLowerCase();

    if (summary.includes('отчет о продажах') || fullPath.includes('report.docx')) {
        // Логика 1: Отчеты о продажах (Категория 01)
        finalCategory = '01';
        suggestedNewName = 'SALES_REPORT_';
        classification = {
            model_reasoning: 'Обнаружены ключевые слова "отчет о продажах".',
            assigned_category: 'Sales'
        };
    } else if (summary.includes('схема') || fullPath.includes('pdf')) {
        // Логика 2: Схемы, документация (Категория 02 - по умолчанию)
        finalCategory = '02';
        suggestedNewName = 'SCHEMA_DOCUMENT_';
        classification = {
            model_reasoning: 'Расширение PDF и ключевое слово "схема" указывают на техническую документацию.',
            assigned_category: 'Technical'
        };
    } else if (summary.includes('лог') || fullPath.includes('txt')) {
        // Логика 3: Логи (Категория 03)
        finalCategory = '03';
        suggestedNewName = 'LOG_DATA_';
        classification = {
            model_reasoning: 'Расширение TXT и упоминание "лог данных" указывает на лог-файл.',
            assigned_category: 'Log'
        };
    } else if (metadata.fullPath.includes('notes.md')) {
        // Логика 4: Примечания (Категория 02, но особое имя)
        finalCategory = '02';
        suggestedNewName = 'NOTE_';
        classification = {
            model_reasoning: 'Файл содержит заметки/примечания.',
            assigned_category: 'Note'
        };
    } else {
        // По умолчанию
        finalCategory = '02';
        suggestedNewName = 'UNKNOWN_';
        classification = { model_reasoning: 'Не удалось определить категорию по логике.', assigned_category: 'Uncategorized' };
    }

    console.log(`[LLM Client] Classification complete. Category: ${finalCategory}, Name: ${suggestedNewName}`);

    return {
        finalCategory: finalCategory,
        suggestedNewName: suggestedNewName,
        classification: classification
    };
}

/**
 * Экспорт публичных методов.
 */
module.exports = {
    classifyFileWithOllama,
};