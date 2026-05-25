/**
 * @file index.test.js
 * @description Integration tests for the main agent orchestration logic in index.js.
 * These tests verify the CLI flag parsing and the end-to-end workflow of the three main features.
 */

// Mocking dependencies
jest.mock('../rcloneTools', () => ({
    rcloneTools: {
        getOnlyDuplicateGroups: jest.fn(),
        exportDuplicateReport: jest.fn(),
        getDirectoryTree: jest.fn(),
        deleteFile: jest.fn(),
        exportDirectoryTree: jest.fn(),
        getItemsToKeep: jest.fn(),
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
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
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
            expect(r.spy).toHaveBeenCalledWith(expect.stringContaining('Successfully detected duplicates'));

            // 3. Check the execution flow
            expect(r.spy).toHaveBeenCalledTimes(2); // Two calls for the initial check and the final summary
            
            // 4. Verify that the removal functions were called (twice)
            expect(r.spy).toHaveBeenCalledWith(expect.stringContaining('removed 2 files'));
        });
    
    // Mock global random object for consistent testing of function calls
    // Note: In a real test suite, you would mock the full 'r' object.
    // For this example, we will assume a mocked global 'r.spy' that tracks calls.
    const r = {
        spy: []
    };
    global.r = r;


    // Additional tests for other features (Classification, Migration Plan) would follow a similar pattern: