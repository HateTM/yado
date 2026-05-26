# Технологии и настройки проекта

## Ядро проекта

- **Стек:** Node.js + TypeScript (backend) + React (webview)
- **Облачные API:** rclone (Yandex Disk, S3, FTP, WebDAV, GCS, Azure Blob, Google Drive, Box, Dropbox, OneDrive)
- **АИС-связь:** Яндекс-браузер (puppeteer) для навигации по веб-интерфейсу

## Основные компоненты

### Backend (src/)

1. **src/core/** — ядро расширения
   - `controller/` — управление состоянием и заданиями
   - `task/` — выполнение API-запросов и инструментов
   - `webview/` — управление webview и коммуникация
   - `slash-commands/` — команды Slash

2. **src/shared/`** — общие типы и утилиты
   - `storage/` — хранилище (globalState, secrets, workspaceState)
   - `proto/` — protobuf определения и типы
   - `api/` — API провайдеры (Anthropic, OpenRouter, etc.)

3. **src/services/mcp/`** — интеграция MCP серверов

4. **src/api/providers/`** — API провайдеры

### Webview (webview-ui/)

- React-приложение для UI расширения
- Сторонняя библиотека puppeteer для работы с браузером

## Хранение данных

### Файловое хранилище (~/.cline/data/)

```
~/.cline/data/
  ├── globalState.json      # Глобальные настройки и состояние
  ├── secrets.json          # API ключи (mode 0o600)
  ├── tasks/
  │   └── taskHistory.json   # История задач
  └── workspaces/
      └── <hash>/
          └── workspaceState.json  # Настройки по workspace
```

### VSCode Storage

**⚠️ НЕ ИСПОЛЬЗУЙТЕ** `context.globalState`, `context.workspaceState`, `context.secrets` напрямую.  
Используйте `StateManager.get().setGlobalState()`, `setSecret()`, `setWorkspaceState()` для кросс-клиентной совместимости.

## API Провайдеры

Поддерживаемые провайдеры:
- Anthropic (Claude)
- OpenRouter
- AWS Bedrock
- Google Gemini
- Cerebras
- Ollama
- LM Studio
- VSCode LM
- OpenAI Codex
- OpenAI Native

**Responses API:** OpenAI Codex/OpenAI Native требуют native tool calling, не используют XML-инструменты.

## Protobuf gRPC

### Файлы определения

- `proto/cline/task.proto` — task операции
- `proto/cline/ui.proto` — UI операции
- `proto/cline/common.proto` — общие типы
- `proto/cline/state.proto` — state management
- `proto/cline/models.proto` — модель конфигурация
- `proto/cline/account.proto` — account operations

### Компиляция

```bash
npm run protos
```

Generates:
- `src/shared/proto/` — shared types
- `src/generated/grpc-js/` — service implementations
- `src/generated/nice-grpc/` — promise-based clients
- `src/generated/hosts/` — generated handlers

## Networking & Proxy

Использовать `fetch` из `@/shared/net` для всех сетевых запросов (поддержка proxy):

```typescript
import { fetch } from '@/shared/net'
const response = await fetch('https://api.example.com/data')
```

Для axios:
```typescript
import axios from 'axios'
import { getAxiosSettings } from '@/shared/net'
await axios.get(url, getAxiosSettings())
```

## Memory Bank Structure

Файлы для отслеживания контекста проекта:
- `projectbrief.md` — требования и цели
- `productContext.md` — описание продукта
- `activeContext.md` — текущая работа
- `systemPatterns.md` — архитектура
- `techContext.md` — технологии (этот файл)
- `progress.md` — статус работы