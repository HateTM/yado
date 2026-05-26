/**
 * @fileoverview Модуль для генерации метаданных и содержимого файла-указателя для РРЛ (Резервное Копирование Пролета).
 * Этот модуль инкапсулирует бизнес-логику создания текстового указателя, который будет размещен в папке 01_ПИР/RRL_Hops.
 */

/**
 * @typedef {object} RRLLinkMetadata
 * @property {string} sourceIdMin - ID БС с меньшим числовым значением (Хост).
 * @property {string} sourceIdMax - ID БС с большим числовым значением (Зеркало).
 * @property {string} description - Подробное описание содержимого, которое объединяют эти два БС.
 * @property {string[]} originalFilesList - Список полных путей ко всем файлам, которые были скопированы в эту ссылку.
 */

/**
 * Генерирует объект метаданных для ссылки РРЛ.
 * @param {string} sourceIdMin - ID БС с меньшим числовым значением (Хост).
 * @param {string} sourceIdMax - ID БС с большим числовым значением (Зеркало).
 * @param {string} description - Описание содержимого.
 * @param {string[]} files - Массив полных путей к файлам, которые были скопированы.
 * @returns {RRLLinkMetadata} Объект метаданных.
 */
function generateLinkMetadata(sourceIdMin, sourceIdMax, description, files) {
    return {
        sourceIdMin: sourceIdMin,
        sourceIdMax: sourceIdMax,
        description: description,
        originalFilesList: files
    };
}

/**
 * Форматирует метаданные в содержимое текстового файла-указателя.
 * @param {RRLLinkMetadata} metadata - Объект метаданных.
 * @returns {string} Содержимое файла в формате Markdown/Текст.
 */
function formatLinkContent(metadata) {
    let content = `# Ссылка на Пролет (РРЛ)\n\n`;
    content += `**Описание:** ${metadata.description}\n\n`;
    content += `**Участники:**\n`;
    content += `*   **Хост (Min ID):** ${metadata.sourceIdMin}\n`;
    content += `*   **Зеркало (Max ID):** ${metadata.sourceIdMax}\n\n`;
    content += `**Состав файлов (${metadata.originalFilesList.length} файлов):**\n`;
    
    metadata.originalFilesList.forEach((filePath, index) => {
        content += `${index + 1}. ${filePath}\n`;
    });
    
    content += `\n--- Конец ссылки РРЛ ---\n`;
    return content;
}

module.exports = {
    generateLinkMetadata,
    formatLinkContent
};
</write_to_file>
<task_progress>
- [ ] Step 1: Silent Investigation (Reading core files and running system analysis)
- [ ] Step 2: Discussion and Questions (Asking necessary clarifying questions)
- [ ] Step 3: Create Implementation Plan Document (Writing implementation_plan.md)
- [x] Step 4: Create Implementation Task (Calling new_task)
</task_progress>
</task_progress>