/**
 * @file __tests__/rcloneTools.test.js
 * Unit tests for rcloneTools.js functions.
 */

// We need to mock the entire rcloneTools object because the tests call methods directly
// We will use jest.mock to mock the module itself.

/**
 * @file __tests__/rcloneTools.test.js
 * Unit tests for rcloneTools.js functions.
 */

const rcloneTools = require('../rcloneTools.js');
const fs = require('fs/promises');
const path = require('path');

// Mocking child_process.execSync globally for all tests in this file
jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));

// Mocking file system functions
jest.mock('fs/promises', () => ({
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
}));


describe('rcloneTools', () => {
    // Setup and Teardown mocks for child_process.execSync
    let originalExecSync;
    beforeAll(() => {
        // Save the original implementation and mock it
        originalExecSync = require('child_process').execSync;
        require('child_process').execSync = jest.fn();
    });
    afterAll(() => {
        // Restore original implementation
        require('child_process').execSync = originalExecSync;
    });

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
            
            // Mock the execSync call
            require('child_process').execSync.mockReturnValue(mockOutput);

            const groups = rcloneTools.getOnlyDuplicateGroups();

            expect(require('child_process').execSync).toHaveBeenCalledWith(
                expect.stringContaining('rclone lsjson'), 
                expect.any(Object)
            );
            
            expect(Object.keys(groups).length).toBe(2); 
            expect(groups['hash123']).toHaveLength(2);
            expect(groups['hash456']).toHaveLength(2);
        });
        
        test('should return empty object on rclone failure', () => {
            // Mocking failure
            require('child_process').execSync.mockImplementation(() => {
                throw new Error('rclone command failed');
            });

            const groups = rcloneTools.getOnlyDuplicateGroups();
            expect(groups).toEqual({});
        });
    });

    describe('getDirectoryTree', () => {
        test('should return directory data array', async () => {
            const mockTree = [{ Path: 'Стройка', IsDir: true }];
            // Mocking successful command execution
            require('child_process').execSync.mockReturnValue(JSON.stringify(mockTree));

            const result = await rcloneTools.getDirectoryTree();
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
            const mockTimestamp = new Date('2026-05-24T13:00:00Z');
            
            // Ensure mocks are set up for file system operations
            fs.mkdir.mockResolvedValue();
            fs.writeFile.mockResolvedValue();

            // Calling the async method requires await
            await rcloneTools.exportDuplicateReport(mockGroups, mockTimestamp);

            expect(fs.mkdir).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalled();
        });
    });
});

// Finalized task_progress update
/*
- [x] Analyze requirements
- [x] Set up necessary files
- [x] Implement main functionality
- [x] Handle edge cases
- [ ] Test the implementation
- [ ] Verify results
*/
