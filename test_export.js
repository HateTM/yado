/**
 * Тестовый скрипт для проверки функциональности экспорта отчетов в rcloneTools.js.
 * ПРИМЕЧАНИЕ: Требует наличия node, и модульного импорта/экспорта для rcloneTools.js.
 */

// Импортируем rcloneTools.js, предполагая, что он доступен в текущей директории
// Используем require для простоты запуска через node
try {
    const { rcloneTools } = require('./rcloneTools'); 

    async function runTest() {
        console.log("============================================");
        console.log("🔬 Запуск проверки функциональности экспорта отчетов...");
        console.log("============================================");

        // 1. Подготавливаем фиктивные данные для дубликатов, которые имитируют вывод rclone lsjson
        const dummyDuplicateGroups = { 
            // Группа 1: Два файла с одинаковым хешем
            'hash1': [{ Path: 'ya:/test/fileA.txt', Name: 'A', Size: 10, ModTime: new Date('2024-01-01T10:00:00Z') }, { Path: 'ya:/test/copyA.txt', Name: 'A', Size: 10, ModTime: new Date('2024-01-01T11:00:00Z') }],
            // Группа 2: Два разных файла, которые попали в группу по ошибке, но тест должен пройти
            'hash2': [{ Path: 'ya:/test/fileB.jpg', Name: 'B', Size: 20, ModTime: new Date('2023-05-01T08:00:00Z') }, { Path: 'ya:/test/copyB.jpg', Name: 'B', Size: 20, ModTime: new Date('2023-05-01T12:00:00Z') }]
        };
        
        const timestamp = new Date();
        
        try {
            // 2. Вызов функции под проверкой
            console.log("\n[TEST] Вызов exportDuplicateReport...");
            const result = await rcloneTools.exportDuplicateReport(dummyDuplicateGroups, timestamp);
            
            console.log("\n--- Результат выполнения ---");
            console.log("Результат функции:", result);

            if (result.success) {
                console.log("✅ Успех: Отчет успешно сгенерирован.");
                console.log(`Путь к отчету: ${result.path}`);
            } else {
                console.error("❌ Неудача: Отчет не удалось сгенерировать.");
                console.error("Ошибка:", result.error);
            }
        } catch (e) {
            console.error("\n🚨 Критическая ошибка при выполнении теста:", e);
        }
        
        console.log("============================================");
    }

    runTest();
} catch(e) {
    console.error("Не удалось запустить тест. Проверьте, что rcloneTools.js корректно экспортирует rcloneTools.");
}