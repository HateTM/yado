// runner.js
// Этот скрипт является точкой входа для запуска процесса копирования папки.
// Он импортирует логику синхронизации из rcloneTools.js.

// Внимание: Так как rcloneTools.js был обновлен с использованием 'import',
// мы должны использовать соответствующий синтаксис ES Modules.
import { rcloneTools } from './rcloneTools.js';

/**
 * Основная функция для запуска процесса копирования папки.
 * @param {string} sourcePath - Полный путь к исходной папке на Яндекс Диске.
 * @param {string} destPath - Полный путь назначения на Яндекс Диске.
 */
async function copyYandexDiskFolder(sourcePath, destPath) {
    try {
        console.log("==================================================");
        console.log(`[START] Инициализация копирования папки.`);
        console.log(`Источник: ${sourcePath}`);
        console.log(`Назначение: ${destPath}`);
        console.log("==================================================");

        // Вызываем реализованную функциональность, которая выполнит rclone copy
        const result = await rcloneTools.copyDirectory(sourcePath, destPath);

        if (result.success) {
            console.log("\n==================================================");
            console.log("✅ Копирование успешно завершено! Данные синхронизированы.");
            console.log("==================================================");
        } else {
            console.error("\n==================================================");
            console.error("❌ Процесс копирования завершился с ошибкой:", result.error);
            console.error("==================================================");
        }
    } catch (error) {
        console.error("\n==================================================");
        console.error("🛑 Критическая ошибка при вызове rcloneTools:", error);
        console.error("==================================================");
    }
}

// ========================================================================
// !!! КОНФИГУРАЦИЯ !!!
// ОБЯЗАТЕЛЬНО ЗАМЕНИТЕ ЭТИ ПУТИ НА РЕАЛЬНЫЕ ПУТИ В ВАШЕМ ПРОФИЛЕ rclone (ya:)
// ==============================================================================
const YANDEX_SOURCE_FOLDER = 'ya:Исполнительная документация/'; 
const YANDEX_DESTINATION_FOLDER = '~/yado/ya_copy/';

// Запуск функции
copyYandexDiskFolder(YANDEX_SOURCE_FOLDER, YANDEX_DESTINATION_FOLDER);