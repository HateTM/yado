# 🚀 Руководство по миграции на Яндекс.Диск

## 📋 Описание

Этот документ описывает процесс миграции файлов между удаленными хранилищами rclone (например, с локальной файловой системы на Яндекс.Диск, между двумя удаленными хранилищами Яндекс.Диск и т.д.).

Миграция осуществляется с использованием утилиты `rclone copy` для эффективного переноса файлов с поддержкой прогресс-баров и откатов при сбоях.

## 🔧 Архитектура

### 1. RcloneManager

Основной класс для управления rclone.
Располагается в файле: `rcloneTools.cjs`

**Основные методы:**

- `testRemoteConnection(remoteName)` - проверка доступности удаленного хранилища
- `copyFile(sourcePath, targetCategory)` - упрощённая обёртка для копирования одного файла
- `copyFiles(sourceRemote, srcPath, destRemote, dstPath)` - основной метод копирования между разными remoутами
- `getOnlyDuplicateGroups()` - поиск групп дубликатов
- `getDirectoryTree(rootPath)` - генерация структуры каталогов
- `deleteFile(filePath)` - удаление файла
- `scanAndMap(oldPaths)` - сканирование старых путей e генерация карт реестрации и миграции

### 2. MigrationEngine

Движок для обработки каталогов, парсинга идентификаторов БС, определения целевых структур и генерации плана миграции.
Располагается в файле: `migrationEngine.js`

**Основные методы:**

- `extractAndStandardizeUid(filePath)` - извлечение стандартизированного UID из пути
- `determineCategory(folderName)` - классификация категории по ключевым словам
- `processFilelistForPlan(fileList)` - обработка списка файлов и построение реестра UID и плана миграции
- `assembleMigrationPlan(processedData)` - генерация финального плана миграции
- `executeFullMigration(oldPaths)` - выполнение полной миграции с RRL-синхронизацией
- `executePartialMigration(oldPaths)` - выполнение частичной миграции

## 📂 Структура файлов

```
rcloneTools.cjs          # Основной модуль для работы с rclone
migrationEngine.js       # Движок миграции
README.md                # Документация
```

## 🚀 Примеры использования

### Пример 1: Копирование одного файла

```javascript
const { RcloneManager } = require('./rcloneTools.cjs');

const rclone = new RcloneManager('ya:');

async function copyFileExample() {
    const source = '/path/to/local/file.txt';
    const category = 'Documents';
    
    await rclone.initializeRcloneService();
    await rclone.copyFile(source, category);
}
```

### Пример 2: Поиск дубликатов

```javascript
const { RcloneManager } = require('./rcloneTools.cjs');

const rclone = new RcloneManager('ya:');

async function findDuplicates() {
    const duplicates = await rclone.getOnlyDuplicateGroups();
    console.log(`Найдено ${duplicates.totalGroups} групп дубликатов`);
    
    await rclone.exportDuplicateReport(duplicates, new Date());
}
```

### Пример 3: Полный цикл миграции БС

```javascript
const { RcloneManager } = require('./rcloneTools.cjs');
const { MigrationEngine } = require('./migrationEngine.js');

async function migrateBaseStations() {
    // Инициализация
    const rclone = new RcloneManager('ya:');
    await rclone.initializeRcloneService();
    
    // Создание движка миграции
    const engine = new MigrationEngine(rclone, 'reports');
    
    // Список старых путей для миграции
    const oldPaths = [
        'BS 37-2971_12345_...',
        '49986-P-76-...',
        'BS-28-112_...'
    ];
    
    // Выполнение полной миграции
    const result = await engine.executeFullMigration(oldPaths);
    
    if (result.success) {
        console.log(`Миграция завершена! План сохранён: ${result.planPath}`);
    }
}
```

## 📊 Форматы идентификаторов

### Старые форматы ID БС:

1. `'BS 37-2971_...'` или `'BS-37-2971'` - формат с префиксом BS
2. `'49986-P-76-...'` - 5 цифр, заглавная буква, 1 цифра и 2-3 цифры
3. `'28586_ИВ_...'` - 5 цифр, подслово, подслово
4. `'бс -19075'` - формат с нижним случаем

### Стандартизированный UID:

Формат: `BS-<КодРегиона>-<УникальныйНомер>`

Примеры:
- `BS-37-2971` - БС из региона 37 (Белгород)
- `BS-49-12345` - БС из региона 49 (Кемерово)
- `BS-28-5432` - БС из региона 28 (Астрахань)

## 🏷️ Категории подкаталогов

| Код | Название | Ключевые слова |
|-----|----------|----------------|
| 01 | survey_pir | ПИР, Обследование |
| 02 | design | Проектирование, КМ, РНС |
| 03 | construction | Стройка, Монтаж, Исполнительная документация |
| 05 | maintenance_to | ТО, Техническое обслуживание, Замеры |
| 08 | archive | Архив |

## ⚠️ Важные замечания

1. Все операции выполняются асинхронно
2. Перед началом миграции убедитесь, что удаленные хранилища настроены и доступны
3. Результаты миграции сохраняются в директории `reports/`
4. Периодически проверяйте статус миграции через консоль или логи

## 🔍 Отладка

При проблемах с миграцией проверьте:

1. Настройки удаленных хранилищ (rclone config)
2. Доступность удаленных хранилищ (`rclone lsjson ya:`)
3. Логи ошибок в консоли
4. Файлы отчетов в директории `reports/`