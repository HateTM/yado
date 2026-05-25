/**
 * @file index.test.js
 * @description Integration tests for the main agent orchestration logic in index.js.
 * These tests verify the CLI flag parsing and the end-to-end workflow of the three main features.
 */

// Mocking dependencies
// Mocking dependencies
const mockRcloneTools = {
    getOnlyDuplicateGroups: jest.fn(),
    exportDuplicateReport: jest.fn(),
    getDirectoryTree: jest.fn(),
    deleteFile: jest.fn(),
    exportDirectoryTree: jest.fn(),
    getItemsToKeep: jest.fn(),
};

// We must explicitly mock the module to ensure properties are accessible and usable for jest.fn() calls.
// We export the entire mocked module structure.
jest.mock('../rcloneTools', () => ({
    rcloneTools: {
        getOnlyDuplicateGroups: mockRcloneTools.getOnlyDuplicateGroups,
        exportDuplicateReport: mockRcloneTools.exportDuplicateReport,
        getDirectoryTree: mockRcloneTools.getDirectoryTree,
        deleteFile: mockRcloneTools.deleteFile,
        exportDirectoryTree: mockRcloneTools.exportDirectoryTree,
        getItemsToKeep: mockRcloneTools.getItemsToKeep,
    }
}));

jest.mock('../agentPrompt', () => ({
    agentPrompt: {
        buildPromptPayload: jest.fn(),
        buildOptimizationPromptPayload: jest.fn(),
    }
}));

// Mocking Node.js built-ins
import { execSync } from 'child_process';
import * as rcloneTools from '../rcloneTools';
import * as agentPrompt from '../agentPrompt';
import { main } from '../index';

// Mocking the main function that needs testing
// Since we cannot import 'main' directly if it's defined in the global scope, 
// we assume the structure allows us to call it directly, or we mock the execution environment.
// For this test, we assume main(args) is the entry point function.

describe('Yandex Disk Agent Core Logic (index.js)', () => {

    // Global setup/teardown for mocking console logs
    let logSpy;
    beforeAll(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        logSpy.mockRestore();
    });

    describe('1. Deduplication Workflow (--dedup)', () => {

        const mockDuplicateGroups = {
            'hash1': [{ Path: 'ya:a/img.jpg', Name: 'img.jpg', Size: 100, ModTime: Date.now() - 1000 }],
            'hash2': [{ Path: 'ya:b/img.jpg', Name: 'img.jpg', Size: 100, ModTime: Date.now() - 2000 }]
        };
        const mockReportPath = 'reports/duplicates_mock.json';
        const mockTimestamp = new Date();

        test('should run full deduplication cycle when --dedup is passed', async () => {
            // Mock success for reports and LLM decision
            rcloneTools.exportDuplicateReport.mockResolvedValue({ success: true, path: 'reports/duplicates_mock.json' });
            agentPrompt.buildPromptPayload.mockResolvedValue(JSON.stringify(mockDuplicateGroups));

            // Mock LLM decision: suggest deleting two files
            rcloneTools.deleteFile.mockResolvedValue(true);

            const args = ['node', 'index.js', '--dedup'];

            await main(args);

            // 1. Verify initialization and reporting
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully detected duplicates'));

            // 2. Check if the report is generated
            expect(rcloneTools.exportDuplicateReport).toHaveBeenCalled();

            // 3. Check the execution flow
            expect(logSpy).toHaveBeenCalledTimes(3); // Expect 3 key log entries: Detection, Report, Summary

            // 4. Verify that the removal functions were called (twice)
            expect(rcloneTools.deleteFile).toHaveBeenCalledTimes(2);
        });

        describe('2. Classification Workflow (--classify)', () => {

            const mockClassificationResult = [{ Path: 'ya:c/doc.pdf', Name: 'doc.pdf', Size: 500, ModTime: Date.now() - 500 }];
            const mockClassificationReportPath = 'reports/classification_mock.json';

            test('should run full classification cycle when --classify is passed', async () => {
                // Mock success for classification report generation
                rcloneTools.exportDirectoryTree.mockResolvedValue({ success: true, path: 'reports/classification_mock.json' });
                agentPrompt.buildOptimizationPromptPayload.mockResolvedValue(JSON.stringify(mockClassificationResult));

                // Mock LLM decision (no action needed for classification in this test)
                // We assume no deletion or sync action is taken.

                const args = ['node', 'index.js', '--classify'];

                await main(args);

                // 1. Verify directory tree extraction
                expect(rcloneTools.exportDirectoryTree).toHaveBeenCalled();

                // 2. Check the payload structure generation
                expect(agentPrompt.buildOptimizationPromptPayload).toHaveBeenCalled();

                // 3. Verify logging indicating completion
                expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Classification process completed'));
            });

            describe('3. Migration Plan Workflow (--migrate)', () => {

                const mockMigrationSummary = {
                    files: 100,
                    totalSizeGB: 15,
                    dirs: 10
                };

                test('should run full migration planning cycle when --migrate is passed', async () => {
                    // Mock success for summary generation
                    agentPrompt.buildOptimizationPromptPayload.mockResolvedValue(JSON.stringify(mockMigrationSummary));

                    // Mock LLM decision (planning, no action needed)

                    const args = ['node', 'index.js', '--migrate'];

                    await main(args);

                    // 1. Verify that the optimization payload was generated
                    expect(agentPrompt.buildOptimizationPromptPayload).toHaveBeenCalled();

                    // 2. Verify logging indicating completion
                    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Migration plan generated successfully'));
                });
            });
        });
    });
})