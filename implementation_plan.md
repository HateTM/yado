# Implementation Plan

## Overview
Система автоматизированной реструктуризации и миграции технической документации базовых станций с поддержкой динамических ID, числового сравнения идентификаторов и интеграцией rclone.

## Types

### BaseStation Registry Entry
```javascript
{
  bsId: string,      // ID БС (строка: "2971", "85", "109075", "49986-P-76")
  bsName: string,    // Оставшееся имя без ID (например, "_Копнинское")
  region: string,    // Название региона (например, "Удмуртия")
  operator: string,  // Название оператора (например, "Мегафон")
  oldPath: string    // Оригинальный путь к папке
}
```

### RRL File Metadata
```javascript
{
  filename: string,         // "[Дата]_[ID-Mеньший]_[ID-Больший]_RRL_[Описание]_v[Версия].ext"
  numericId1: number,       // Меньший числовой ID (Хост)
  numericId2: number,       // Больший числовой ID (Зеркало)
  region: string,           // Регион БС
  operator: string,         // Оператор связи
  description: string,      // Описание пролета (частота, тип, длина)
  version: number,          // Версия файла
  originalPath: string,     // Текущий путь файла
  targetHostPath: string,   // Путь на Хосте
  targetMirrorPath: string  // Путь ссылки на Зеркале
}
```

## Files

### New Files to Create:
1. `rclone-cli-wrapper.js` - Обёртка для выполнения rclone команд
2. `migrationEngine.js` - Ядро миграции с логикой Host/Mirror
3. `index.js` - Точка входа проекта
4. `package.json` - Зависимости проекта
5. `README.md` - Инструкция для инженеров

### Existing Files to Modify:
- None in this iteration

## Functions

### New Functions:

#### `rclone-cli-wrapper.js`:
- `executeRcloneCommand(command)` - Выполняет команду rclone и возвращает stdout/stderr
- `copyFileToRemote(src, dest, remote, container)` - Копирование файла в облако с rename
- `mkdirInRemote(remote, container, path)` - Создание папки в облаке
- `listRemoteDirectory(remote, container, path)` - Листинг директории в облаке

#### `migrationEngine.js`:
- `getNumericId(rawId)` - Извлекает числовой ID из строки
- `extractBsIdFromPath(oldPath)` - Извлекает ID из старого пути
- `extractRegionAndOperator(oldPath)` - Парсит регион и оператора
- `generateNewCloudPath(bsId, bsName, region, operator)` - Формирует новый путь
- `isHostOrMirror(numericId1, numericId2)` - Определяет роль (Host/Mirror)
- `processRRLFile(fileMetadata, bsRegistry)` - Обрабатывает файл РРЛ (размещает на Host, создаёт ссылку на Mirror)
- `processBsDirectory(bsEntry)` - Обработчик папки БС (создаёт структуру подпапок)
- `migrateBs(bsEntry, rrlFile)` - Миграция конкретной БС

#### `index.js`:
- `scanArchives(archivePath)` - Запуск сканирования
- `deployCloudStructure(csvPaths)` - Развёртывание в облаке
- `uploadRRLFile(rlFilePath)` - Загрузка файла РРЛ

## Classes

No new classes in this iteration.

## Dependencies

### New Dependencies:
- None - используем только встроенные модули Node.js:
  - `fs/promises`
  - `path`
  - `child_process`

## Testing

Тестирование через CLI-команды с проверкой:
- Валидность генерируемых CSV-файлов
- Корректность вызовов rclone (проверка выхода)
- Числовое сравнение ID (тесты с разными форматами)

## Implementation Order

1. Создать `implementation_plan.md` и `package.json` (Шаг 1)
2. Реализовать `rcloneTools.cjs` и команду `--scan` (Шаг 2) ✓
3. Реализовать `rclone-cli-wrapper.js` и `migrationEngine.js` (Шаг 3)
4. Создать `index.js` и команду `--upload-rrl` (Шаг 4)
5. Создать `README.md` (Шаг 5)