#!/usr/bin/env node

/**
 * Rclone CLI Wrapper
 * Обёртка для работы с rclone с поддержкой всех необходимых параметров
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Настройки rclone
const RCLONE_CMD = 'rclone';
const DEFAULT_TIMEOUT = 120000; // 120 секунд (достаточно для больших файлов)
const MAX_ARGS = 100; // Максимум аргументов в одной команде

// Кэш информации о remote (необязательно для оптимизации)
const remoteCache = new Map();

/**
 * Проверяет, установлен ли rclone
 */
function isRcloneInstalled() {
return execSync('which rclone', { encoding: 'utf-8', stdio: 'pipe' }).trim() !== '';
}

/**
 * Проверяет версии rclone
 */
function getRcloneVersion() {
try {
const result = execSync(`${RCLONE_CMD} version --quiet`, { encoding: 'utf-8', timeout: 30000 }).trim();
const version = parseInt(result.split(' ').pop());
if (version < 16) {
console.warn(`[RcloneWrapper] Требуется rclone версии 16+, у вас: ${version}`);
}
return result;
} catch (err) {
return null;
}
}

/**
 * Форматирует размер в байтах в человеческий формат
 */
function formatBytes(bytes) {
if (bytes === 0) return '0 B';
const k = 1024;
const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Извлекает информацию о remote (список файлов, размер, last_modified)
 */
function listRemote(remote) {
const listCmd = `${RCLONE_CMD} list ${remote}`;
const statCmd = `${RCLONE_CMD} stat ${remote}`;

try {
// Получаем список файлов
const listOutput = execSync(listCmd, { encoding: 'utf-8', timeout: DEFAULT_TIMEOUT });
const files = listOutput.trim().split('\n').filter(f => f.trim());

// Получаем статистику для каждого файла
const stats = [];
for (const file of files) {
try {
const statOutput = execSync(`${statCmd} --include "${file}"`, { encoding: 'utf-8', timeout: DEFAULT_TIMEOUT });
const statLines = statOutput.trim().split('\n');

const fileInfo = {};
for (const line of statLines) {
const [key, value] = line.split(': ');
if (key && value) {
// Преобразуем размер в байты
if (key === 'Size') {
const size = value.split(' ')[0].replace(/B/, '');
fileInfo[key] = parseInt(size, 10);
} else {
fileInfo[key] = value.trim();
}
}
}

if (fileInfo.Size) {
stats.push({
name: file,
size: fileInfo.Size,
'last_modified': fileInfo.ModTime,
'last_modified_human': fileInfo.ModTime
});
}
} catch (fileStatErr) {
// Файл может не существовать
}
}

return { files, stats };
} catch (err) {
console.error(`[RcloneWrapper] Ошибка при получении списка файлов: ${err.message}`);
return null;
}
}

/**
 * Получает информацию о конкретном файле в remote
 */
function getRemoteFileInfo(remote, file) {
try {
const statOutput = execSync(`${RCLONE_CMD} stat --include "${file}" "${remote}"`, { encoding: 'utf-8', timeout: DEFAULT_TIMEOUT });
const statLines = statOutput.trim().split('\n');

const fileInfo = {};
for (const line of statLines) {
const [key, value] = line.split(': ');
if (key && value) {
if (key === 'Size') {
const size = value.split(' ')[0].replace(/B/, '');
fileInfo[key] = parseInt(size, 10);
} else {
fileInfo[key] = value.trim();
}
}
}

return fileInfo;
} catch (err) {
return null;
}
}

/**
 * Проверяет, существует ли файл в remote
 */
function fileExists(remote, file) {
try {
const statOutput = execSync(`${RCLONE_CMD} stat --include "${file}" "${remote}"`, { encoding: 'utf-8', timeout: DEFAULT_TIMEOUT });
return true;
} catch (err) {
return false;
}
}

/**
 * Формирует команду rclone и выполняет её
 */
function runRcloneCommand(args, options = {}) {
const { command, stdout = 'pipe', stderr = 'pipe', timeout = DEFAULT_TIMEOUT } = options;

if (!command) {
throw new Error('Команда rclone не может быть пустой');
}

return new Promise((resolve, reject) => {
try {
const cmdString = command.replace(/"/g, '\\"'); // Escape quotes
const output = execSync(cmdString, { 
encoding: 'utf-8',
timeout: timeout,
maxBuffer: 1024 * 1024 * 1024, // 1 ГБ
stdout,
stderr
});

resolve({
stdout: stdout === 'pipe' ? output : null,
stderr: stderr === 'pipe' ? output : null
});
} catch (err) {
reject(new Error(`[RcloneWrapper] Команда выполнилась с ошибкой: ${err.message}\nВывод: ${err.stdout || err.stderr}`));
}
});
}

/**
 * Собирает аргументы для команды rclone
 */
function buildRcloneArgs(baseArgs, overrides = {}) {
const args = [...baseArgs];

if (overrides.from) args.push('--source', overrides.from);
if (overrides.to) args.push('--dest', overrides.to);
if (overrides.flags) args.push(...overrides.flags);
if (overrides.file) args.push('--include', overrides.file);
if (overrides.filter) args.push('--filter', overrides.filter);
if (overrides.exclude) args.push('--exclude', overrides.exclude);
if (overrides.config) args.push('--config', overrides.config);
if (overrides.verbose) args.push('--verbose');
if (overrides.remcache) args.push('--recheck');

return args;
}

/**
 * Массовая загрузка файлов
 */
async function uploadFiles(options) {
const {
from,           // Источник (локальный путь или remote)
to,            // Цель (remote или локальный путь)
preserve = false,
force = true,
filter = null,
exclude = null,
onProgress = null
} = options;

if (!from || !to) {
throw new Error('Требуется указать --from и --to');
}

const args = [
'copy',
`--source=${from}`,
`--dest=${to}`,
`--delete-before=${String(force)}`,
`--progress=${String(preserve)}`
];

// Фильтры
if (filter) {
args.push('--filter', filter);
}

// Исключения
if (exclude) {
args.push('--exclude', exclude);
}

try {
const result = await runRcloneCommand(args.join(' '));
console.log(result.stdout);
return { success: true, output: result.stdout };
} catch (err) {
throw err;
}
}

/**
 * Массовая синхронизация
 */
async function syncFolders(options) {
const { from, to, preserve = false, force = true, filter = null } = options;

if (!from || !to) {
throw new Error('Требуется указать --from и --to');
}

const args = [
'sync',
`--source=${from}`,
`--dest=${to}`,
`--delete-before=${String(force)}`,
`--progress=${String(preserve)}`
];

// Фильтры
if (filter) {
args.push('--filter', filter);
}

try {
const result = await runRcloneCommand(args.join(' '));
console.log(result.stdout);
return { success: true, output: result.stdout };
} catch (err) {
throw err;
}
}

/**
 * Удаление файла из remote
 */
async function deleteRemoteFile(remote, file) {
if (!remote || !file) {
throw new Error('Требуется указать remote и файл для удаления');
}

try {
const cmd = `${RCLONE_CMD} delete "${remote}"` + (file ? `"${file}"` : '');
const result = await runRcloneCommand(cmd);
console.log(result.stdout);
return { success: true, deleted: file };
} catch (err) {
throw err;
}
}

/**
 * Проверка доступности remote
 */
async function checkRemote(remote) {
if (!remote) {
throw new Error('Требуется указать remote');
}

try {
const cmd = `${RCLONE_CMD} copy "${remote}" /tmp/ --dry-run --files-only`;
const result = await runRcloneCommand(cmd);
return { success: true, message: 'Remote доступен' };
} catch (err) {
throw new Error(`Remote недоступен: ${err.message}`);
}
}

/**
 * Получение списка файлов в remote
 */
async function listFiles(remote, recursive = false, prefix = '') {
if (!remote) {
throw new Error('Требуется указать remote');
}

try {
let cmd = recursive ? `${RCLONE_CMD} ls -R "${remote}"` : `${RCLONE_CMD} ls "${remote}"`;

// Добавляем префикс
if (prefix) {
cmd = `${RCLONE_CMD} ls "${remote}/${prefix}"`;
}

const result = await runRcloneCommand(cmd);
const files = result.stdout ? result.stdout.trim().split('\n').filter(f => f.trim()) : [];

return {
files,
total: files.length
};
} catch (err) {
throw new Error(`Не удалось получить список файлов: ${err.message}`);
}
}

/**
 * Создание директории в remote
 */
async function createRemoteFolder(remote, folder) {
if (!remote || !folder) {
throw new Error('Требуется указать remote и папку');
}

try {
const cmd = `${RCLONE_CMD} mkdir -p "${remote}/${folder}"`;
const result = await runRcloneCommand(cmd);
return { success: true, path: remote + '/' + folder };
} catch (err) {
throw new Error(`Не удалось создать папку: ${err.message}`);
}
}

/**
 * Загрузка файла в remote
 */
async function uploadFile(source, remote, destination) {
if (!source || !remote) {
throw new Error('Требуется указать source и remote');
}

const dest = destination || remote;

try {
const cmd = `${RCLONE_CMD} copy "${source}" "${dest}"`;
const result = await runRcloneCommand(cmd);
const info = result.stdout ? result.stdout.trim() : '';
const size = info.match(/Size:\s+(\S+)/)?.[1] || 'N/A';
const modTime = info.match(/ModTime:\s+(\S+)/)?.[1] || 'N/A';

return {
success: true,
path: dest,
size,
'last_modified': modTime
};
} catch (err) {
throw new Error(`Не удалось загрузить файл: ${err.message}`);
}
}

/**
 * Соединение (cat) файлов в remote
 */
async function catFiles(options) {
const { from = '.', to, remote = null, prefix = null } = options;

const args = [
'cat',
`--source=${from}`,
`--dest=${to}`
];

if (remote && prefix) {
args.push(`--remote=${remote}`);
args.push(`--remote-file=${prefix}`);
}

try {
const result = await runRcloneCommand(args.join(' '));
return { success: true, output: result.stdout };
} catch (err) {
throw err;
}
}

/**
 * Получение информации о файле
 */
async function fileInfo(remote, file) {
const info = await getRemoteFileInfo(remote, file);
if (!info) {
return null;
}

return {
name: file,
size: info.Size || null,
'last_modified': info.ModTime || null,
'last_modified_human': info.ModTime || null
};
}

module.exports = {
RCLONE_CMD,
DEFAULT_TIMEOUT,
remoteCache,
isRcloneInstalled,
getRcloneVersion,
formatBytes,
listRemote,
getRemoteFileInfo,
fileExists,
runRcloneCommand,
buildRcloneArgs,
uploadFiles,
syncFolders,
deleteRemoteFile,
checkRemote,
listFiles,
createRemoteFolder,
uploadFile,
catFiles,
fileInfo,

// Старые алиасы
upload: uploadFiles,
sync: syncFolders,
delete: deleteRemoteFile,
list: listFiles,
exists: fileExists,
check: checkRemote
};
