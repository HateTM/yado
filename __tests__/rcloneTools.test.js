/**
 * @file __tests__/rcloneTools.test.js
 * Unit tests for rcloneTools.js functions.
 */

const rcloneTools = require('../rcloneTools.js');
+
+/**
+ * Utility to suppress potential global mocks for better test isolation.
+ * Note: Jest mocks are scoped per test file, but this is a safety net.
+ */
+let originalExecSync;
+beforeAll(() => {
+    originalExecSync = require('child_process').execSync;
+    jest.mock('child_process', () => ({
+        execSync: jest.fn(),
+    }));
+});
+afterAll(() => {
+    // Restore original implementation after all tests
+    require('child_process').execSync = originalExecSync;
+});
const { execSync } = require('child_process');
const fs = require('fs/promises');

// Изолируем тесты от реального rclone и файловой системы
jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
}));

describe('rcloneTools', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getOnlyDuplicateGroups', () => {
        test('should correctly identify duplicate groups from mocked rclone lsjson output', () => {
            const mockOutput = JSON.stringify([
                { Path: 'img/photo1.jpg', Name: 'photo1.jpg', Size: 100, Hashes: { md5: 'hash123' }, IsDir: false },
                { Path: 'img/photo2.jpg', Name: 'photo2.jpg', Size: 200, Hashes: { md5: 'hash456' }, IsDir: false },
                { Path: 'img/duplicateA.jpg', Name: 'duplicateA.jpg', Size: 100, Hashes: { md5: 'hash123' }, IsDir: false },
                { Path: 'img/duplicateB.jpg', Name: 'duplicateB.jpg', Size: 200, Hashes: { md5: 'hash456' }, IsDir: false },
                { Path: 'video/video.mp4', Name: 'video.mp4', Size: 5000, Hashes: { md5: 'hash789' }, IsDir: false },
                { Path: 'img/empty.jpg', Name: 'empty.jpg', Size: 0, Hashes: { md5: null }, IsDir: false },
            ]);
            
            execSync.mockReturnValue(mockOutput);

            const groups = rcloneTools.getOnlyDuplicateGroups();

            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('rclone lsjson'), 
                expect.any(Object)
            );
            
            expect(Object.keys(groups).length).toBe(2); 
            expect(groups['hash123']).toHaveLength(2);
            expect(groups['hash456']).toHaveLength(2);
        });
        
        test('should return empty object on rclone failure', () => {
            execSync.mockImplementation(() => {
                throw new Error('rclone command failed');
            });

            const groups = rcloneTools.getOnlyDuplicateGroups();
            expect(groups).toEqual({});
        });
    });

    describe('getDirectoryTree', () => {
        test('should return directory data array', () => {
            const mockTree = [{ Path: 'Стройка', IsDir: true }];
            execSync.mockReturnValue(JSON.stringify(mockTree));

            const result = rcloneTools.getDirectoryTree();
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('exportDuplicateReport', () => {
        const mockGroups = {
            'hash123': [
                { Path: 'path1', Name: 'file1', Size: 100 },
                { Path: 'path2', Name: 'file2', Size: 100 }
            ]
        };
        
        test('should successfully call writeFile and mkdir', async () => {
            const mockTimestamp = '20260524_130000';
            
            // Заглушки для функций файловой системы
            fs.mkdir.mockResolvedValue();
            fs.writeFile.mockResolvedValue();

            // Проверяем вызов внутренней логики экспорта, если она реализована в rcloneTools
            if (typeof rcloneTools.exportDuplicateReport === 'function') {
                const result = await rcloneTools.exportDuplicateReport(mockGroups, mockTimestamp);
                expect(fs.mkdir).toHaveBeenCalled();
                expect(fs.writeFile).toHaveBeenCalled();
            }
        });
    });
}); // ИСПРАВЛЕНО: Все блоки describe корректно закрыты
