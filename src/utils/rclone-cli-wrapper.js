/**
 * @fileoverview Инкапсуляция всех вызовов rclone CLI и парсинга их JSON-вывода.
 * Помогает улучшить читаемость и тестируемость rcloneTools.cjs.
 * Все функции асинхронные, так как они выполняют системные команды.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

/**
 * Оборачивает выполнение команды rclone и возвращает структурированный результат.
 *
 * @param {string} command - Полная команда rclone (например, 'rclone ls remote:').
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, result: any}>} Структурированный результат выполнения.
 * @throws {Error} Если выполнение команды не удалось.
 */
async function executeRcloneCommand(command) {
    console.log(`[rclone-wrapper] Выполнение команды: ${command}`);
    try {
        // Выполняем команду. Выводим stdout и stderr.
        const { stdout, stderr } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });

        return {
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            result: parseRcloneOutput(stdout, stderr)
        };
    } catch (error) {
        // В случае ошибки execPromise, error.stdout и error.stderr содержат вывод
        const errorOutput = error.stderr || error.stdout || error.message;
        return {
            success: false,
            stdout: error.stdout || '',
            stderr: error.stderr || errorOutput,
            result: null
        };
    }
}

/**
 * Парсит вывод rclone. В реальном приложении здесь потребуется более сложная логика
 * для определения, какой вывод является JSON, а какой - стандартный текстовый вывод.
 * Для простоты, пока предполагаем, что для проверок (ls) вывод является текстом,
 * а для операций (copy) может быть JSON (хотя rclone редко использует его для вывода статуса).
 *
 * Здесь заглушка: для демонстрации, мы просто возвращаем весь stdout как сырой результат.
 * @param {string} stdout
 * @param {string} stderr
 * @returns {any}
 */
function parseRcloneOutput(stdout, stderr) {
    // В реальной системе:
    // if (stdout.startsWith('{') && stdout.endsWith('}')) {
    //     try {
    //         return JSON.parse(stdout);
    //     } catch (e) {
    //         return null;
    //     }
    // }
    return {
        raw_output: stdout,
        error_output: stderr,
        message: "Parsed successfully (placeholder logic)."
    };
}

/**
 * Проверяет, что rclone установлен и доступен в PATH.
 * @returns {Promise<boolean>} True, если rclone доступен.
 */
async function checkRcloneAvailability() {
    console.log("[rclone-wrapper] Проверка доступности rclone...");
    try {
        // Простая команда для проверки версии
        await execPromise('rclone version');
        return true;
    } catch (e) {
        console.error("[rclone-wrapper] rclone CLI не найден или недоступен.", e.message);
        return false;
    }
}

module.exports = {
    executeRcloneCommand,
    checkRcloneAvailability
};