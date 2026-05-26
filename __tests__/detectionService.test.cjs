/**
 * @file __tests__/detectionService.test.js
 * Unit tests for DetectionService class.
 */

// Mocking the new centralized logging service to ensure tests are isolated
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
};
jest.mock('../src/utils/LoggingService', () => ({
    __esModule: true,
    default: mockLogger,
}));

const { DetectionService } = require('../src/services/detection-service');

describe('DetectionService', () => {
    // Тест 1: Проверка базового обнаружения типа данных по пути и содержимому
    describe('detectType', () => {
        test('should detect JSON type if path and content indicate JSON structure', () => {
            const path = 'data.json';
            const content = '{"key": "value"}';
            const result = DetectionService.detectType(path, content);
            
            expect(result.type).toBe('JSON');
            expect(result.confidence).toBe(0.9);
        });

        test('should detect generic text type for standard files', () => {
            const path = 'readme.txt';
            const content = 'This is some text.';
            const result = DetectionService.detectType(path, content);
            
            expect(result.type).toBe('TEXT');
            expect(result.confidence).toBe(0.8);
        });

        test('should handle missing path or content gracefully', () => {
            const result1 = DetectionService.detectType(null, 'some content');
            const result2 = DetectionService.detectType('path.txt', null);

            expect(result1.type).toBe('UNKNOWN');
            expect(result2.type).toBe('UNKNOWN');
        });
    });

    // Тест 2: Проверка анализа качества контента по метаданным
    describe('detectContentQuality', () => {
        test('should classify large files as LARGE_MEDIA', () => {
            const metadata = { size: 1024 * 1024 + 1, hash: 'abc' }; // > 1MB
            const result = DetectionService.detectContentQuality(metadata, null);
            
            expect(result.type).toBe('LARGE_MEDIA');
            expect(result.confidence).toBe(0.95);
        });

        test('should classify standard files correctly', () => {
            const metadata = { size: 500 * 1024, hash: 'xyz' }; // < 1MB
            const result = DetectionService.detectContentQuality(metadata, null);
            
            expect(result.type).toBe('STANDARD_DATA');
            expect(result.confidence).toBe(0.7);
        });
        
        test('should handle missing metadata', () => {
            const result = DetectionService.detectContentQuality(null, null);
            expect(result.type).toBe('STANDARD_DATA');
        });
    });
});