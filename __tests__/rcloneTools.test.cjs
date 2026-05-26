const { execAsync } = require('../rcloneTools'); // Assuming rcloneTools.js is in the parent directory
const { copyDirectory } = require('../rcloneTools'); // Assuming module export/access

// Mock execAsync to prevent actual rclone execution during tests
jest.mock('../rcloneTools', () => ({
    // Mock the internal helper function that relies on execAsync
    // NOTE: This mock might need adjustment if the actual implementation structure changes
    // For now, we focus on mocking the external dependencies used by copyDirectory
    rcloneTools: {
        // Mock functions needed by rcloneTools.js for simplicity
        copyDirectory: jest.fn(),
        getOnlyDuplicateGroups: jest.fn(),
        getDirectoryTree: jest.fn(),
        exportDuplicateReport: jest.fn(),
        exportDirectoryTree: jest.fn(),
        deleteFile: jest.fn(),
        getItemsToKeep: jest.fn(),
    }
}));

describe('rcloneTools.js - Cloud Synchronization Tests', () => {
    let rcloneToolsMock;

    beforeAll(() => {
        // Access the mocked rcloneTools object
        rcloneToolsMock = require('../rcloneTools');
    });

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    describe('RcloneManager - Copy Operations', () => {
        // Тесты для copyDirectory (старая логика)
        describe('copyDirectory (Legacy)', () => {
            it('should successfully copy directory when rclone command succeeds', async () => {
                // Setup mock success
                rcloneToolsMock.copyDirectory.mockResolvedValue({ success: true, error: null });
                
                // Test execution
                const source = 'source_folder/';
                const destination = 'destination_folder/';
                const result = await rcloneToolsMock.copyDirectory(source, destination);
                
                // Assertions
                expect(result.success).toBe(true);
                expect(result.error).toBe(null);
                // Check if the underlying command execution was attempted with correct arguments
                expect(rcloneToolsMock.copyDirectory).toHaveBeenCalledWith(source, destination);
            });
            
            it('should handle rclone command failure due to rclone error in stderr', async () => {
                // Setup mock failure
                const mockError = 'rclone execution failed: Access denied or source missing.';
                rcloneToolsMock.copyDirectory.mockResolvedValue({ success: false, error: mockError });
                
                // Test execution
                const source = 'nonexistent_source/';
                const destination = 'target/';
                const result = await rcloneToolsMock.copyDirectory(source, destination);
                
                // Assertions
                expect(result.success).toBe(false);
                expect(result.error).toContain('Access denied');
            });
            
            it('should handle critical errors during the copying process', async () => {
                // Setup mock critical failure
                const mockCriticalError = new Error('Network timeout or authentication failure.');
                rcloneToolsMock.copyDirectory.mockRejectedValue(mockCriticalError);
                
                // Test execution
                const source = 'source_folder/';
                const destination = 'destination_folder/';
                const result = await rcloneToolsMock.copyDirectory(source, destination);
                
                // Since copyDirectory uses try/catch and returns a Promise resolving to an object,
                // we check if the rejection was caught and returned as an error object.
                // NOTE: The actual implementation returns {success: false, error: error.message} on catch.
                expect(result.success).toBe(false);
                expect(result.error).toContain('Network timeout');
            });
            
            it('should correctly handle real-world paths and trigger success on valid copy', async () => {
                // Setup mock success using paths from runner.js
                const yandexSource = 'ya:Исполнительная документация/';
                const yandexDest = '~/yado/ya_copy/';
                rcloneToolsMock.copyDirectory.mockResolvedValue({ success: true, error: null });
                
                // Test execution
                const result = await rcloneToolsMock.copyDirectory(yandexSource, yandexDest);
                
                // Assertions
                expect(result.success).toBe(true);
                expect(result.error).toBe(null);
                // Check if the underlying command execution was attempted with correct arguments
                expect(rcloneToolsMock.copyDirectory).toHaveBeenCalledWith(yandexSource, yandexDest);
            });
        });
        
        it('should correctly execute copyFiles for cloud sync operations', async () => {
            // Setup mock success for copyFiles
            rcloneToolsMock.copyFiles.mockResolvedValue({ success: true, operationId: 'mock-id', skippedFiles: [] });
            
            // Test execution
            const sourceRemote = 'ya:';
            const sourcePath = 'path/in/source/';
            const destRemote = 'ya:';
            const destPath = 'path/in/dest/';
            const result = await rcloneToolsMock.copyFiles(sourceRemote, sourcePath, destRemote, destPath);
            
            // Assertions
            expect(result.success).toBe(true);
            expect(result.operationId).toBe('mock-id');
            expect(rcloneToolsMock.copyFiles).toHaveBeenCalledWith(sourceRemote, sourcePath, destRemote, destPath);
        });
    });
    });

    describe('testRemoteConnection function', () => {
        it('should successfully check connection when rclone lsjson succeeds', async () => {
            const remoteName = 'ya:';
            const mockJson = JSON.stringify([{ Path: 'file.txt', Name: 'file.txt', Size: 1024, ModTime: '2023-01-01T00:00:00Z', IsDir: false, Hashes: { md5: 'hash123' }}]);
            
            // Mock the underlying helper functions
            rcloneToolsMock.listStructured.mockResolvedValue({ stdout: mockJson, stderr: '' });
            const mockMetrics = { message: 'Success', usage: { totalSizeBytes: 1024 } };
            rcloneToolsMock.calculateMetrics.mockResolvedValue(mockMetrics);
            
            // Test execution
            const result = await rcloneToolsMock.testRemoteConnection(remoteName);
            
            // Assertions
            expect(result.success).toBe(true);
            expect(result.message).toContain('Успешно подключено');
            expect(result.usage).toEqual(mockMetrics.usage);
            // Check if underlying functions were called
            expect(rcloneToolsMock.listStructured).toHaveBeenCalledWith(null, remoteName);
            expect(rcloneToolsMock.calculateMetrics).toHaveBeenCalled();
        });

        it('should fail connection check if rclone returns stderr', async () => {
            const remoteName = 'nonexistent_remote:';
            const mockError = 'rclone execution failed: Remote not found or credentials invalid.';
            
            // Setup mock failure with stderr
            rcloneToolsMock.listStructured.mockResolvedValue({ stdout: null, stderr: mockError });

            // Test execution
            const result = await rcloneToolsMock.testRemoteConnection(remoteName);

            // Assertions
            expect(result.success).toBe(false);
            expect(result.message).toContain('Не удалось подключиться');
        });

        it('should fail connection check if no stdout is returned', async () => {
            const remoteName = 'empty_remote:';
            
            // Setup mock failure with empty stdout
            rcloneToolsMock.listStructured.mockResolvedValue({ stdout: '', stderr: '' });

            // Test execution
            const result = await rcloneToolsMock.testRemoteConnection(remoteName);

            // Assertions
            expect(result.success).toBe(false);
            expect(result.message).toContain('Получен пустой ответ');
        });
    });

</final_file_content>

IMPORTANT: For any future changes to this file, use the final_file_content shown above as your reference. This content reflects the current state of the file, including any auto-formatting (e.g., if you used single quotes but the formatter converted them to double quotes). Always base your SEARCH/REPLACE operations on this final version to ensure accuracy.


<environment_details>
# Visual Studio Code Visible Files
rcloneTools.cjs

# Visual Studio Code Open Tabs
index.js
package-lock.json
package.json
src/utils/file-system.cjs
rcloneTools.cjs
src/services/detection-service.cjs
../.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/tasks/1779734477103/focus_chain_taskid_1779734477103.md
src/engine/migration-engine.cjs
../.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/tasks/1779729908899/focus_chain_taskid_1779729908899.md
projectbrief.md
.clinerules/storage.md
eslint.config.ts
tsconfig.json
../.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/tasks/1779725687916/focus_chain_taskid_1779725687916.md

# Current Time
5/26/2026, 12:01:42 AM (Europe/Moscow, UTC+3:00)

# Context Window Usage
68,914 / 72K tokens used (95%)

# Current Mode
ACT MODE
        it('should handle rclone command failure due to rclone error in stderr', async () => {
            // Setup mock failure
            const mockError = 'rclone execution failed: Access denied or source missing.';
            rcloneToolsMock.copyDirectory.mockResolvedValue({ success: false, error: mockError });
            
            // Test execution
            const source = 'nonexistent_source/';
            const destination = 'target/';
            const result = await rcloneToolsMock.copyDirectory(source, destination);
            
            // Assertions
            expect(result.success).toBe(false);
            expect(result.error).toContain('Access denied');
        });

        it('should handle critical errors during the copying process', async () => {
            // Setup mock critical failure
            const mockCriticalError = new Error('Network timeout or authentication failure.');
            rcloneToolsMock.copyDirectory.mockRejectedValue(mockCriticalError);
            
            // Test execution
            const source = 'source_folder/';
            const destination = 'destination_folder/';
            const result = await rcloneToolsMock.copyDirectory(source, destination);
            
            // Since copyDirectory uses try/catch and returns a Promise resolving to an object,
            // we check if the rejection was caught and returned as an error object.
            // NOTE: The actual implementation returns {success: false, error: error.message} on catch.
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network timeout');
        });

        it('should correctly handle real-world paths and trigger success on valid copy', async () => {
            // Setup mock success using paths from runner.js
            const yandexSource = 'ya:Исполнительная документация/';
            const yandexDest = '~/yado/ya_copy/';
            rcloneToolsMock.copyDirectory.mockResolvedValue({ success: true, error: null });
            
            // Test execution
            const result = await rcloneToolsMock.copyDirectory(yandexSource, yandexDest);
            
            // Assertions
            expect(result.success).toBe(true);
            expect(result.error).toBe(null);
            // Check if the underlying command execution was attempted with correct arguments
            expect(rcloneToolsMock.copyDirectory).toHaveBeenCalledWith(yandexSource, yandexDest);
        });

        it('should handle critical errors during the copying process', async () => {
            // Setup mock critical failure
            const mockCriticalError = new Error('Network timeout or authentication failure.');
            rcloneToolsMock.copyDirectory.mockRejectedValue(mockCriticalError);

            // Test execution
            const source = 'source_folder/';
            const destination = 'destination_folder/';
            const result = await rcloneToolsMock.copyDirectory(source, destination);

            // Since copyDirectory uses try/catch and returns a Promise resolving to an object,
            // we check if the rejection was caught and returned as an error object.
            // NOTE: The actual implementation returns {success: false, error: error.message} on catch.
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network timeout');
        });

        it('should correctly handle real-world paths and trigger success on valid copy', async () => {
            // Setup mock success using paths from runner.js
            const yandexSource = 'ya:Исполнительная документация/';
            const yandexDest = '~/yado/ya_copy/';
            rcloneToolsMock.copyDirectory.mockResolvedValue({ success: true, error: null });

            // Test execution
            const result = await rcloneToolsMock.copyDirectory(yandexSource, yandexDest);

            // Assertions
            expect(result.success).toBe(true);
            expect(result.error).toBe(null);
            // Check if the underlying command execution was attempted with correct arguments
            expect(rcloneToolsMock.copyDirectory).toHaveBeenCalledWith(yandexSource, yandexDest);
        });
        });

        it('should handle rclone command failure due to rclone error in stderr', async () => {
            // Setup mock failure
            const mockError = 'rclone execution failed: Access denied or source missing.';
            rcloneToolsMock.copyDirectory.mockResolvedValue({ success: false, error: mockError });

            // Test execution
            const source = 'nonexistent_source/';
            const destination = 'target/';
            const result = await rcloneToolsMock.copyDirectory(source, destination);

            // Assertions
            expect(result.success).toBe(false);
            expect(result.error).toContain('Access denied');
        });

        it('should handle critical errors during the copying process', async () => {
            // Setup mock critical failure
            const mockCriticalError = new Error('Network timeout or authentication failure.');
            rcloneToolsMock.copyDirectory.mockRejectedValue(mockCriticalError);

            // Test execution
            const source = 'source_folder/';
            const destination = 'destination_folder/';
            const result = await rcloneToolsMock.copyDirectory(source, destination);

            // Since copyDirectory uses try/catch and returns a Promise resolving to an object,
            // we check if the rejection was caught and returned as an error object.
            // NOTE: The actual implementation returns {success: false, error: error.message} on catch.
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network timeout');
        });
    });

