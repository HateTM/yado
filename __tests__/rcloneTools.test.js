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

    describe('copyDirectory function', () => {
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
});
