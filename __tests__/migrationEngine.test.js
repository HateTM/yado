const MigrationEngine = require('../src/engine/migration-engine');
const { getBatchFileMetadata } = require('../src/utils/file-system');
const DetectionService = require('../src/services/detection-service');
const { jest } = require('@jest/globals');

// Мокируем зависимости для тестирования
jest.mock('../src/utils/file-system', () => ({
    getBatchFileMetadata: jest.fn()
}));
jest.mock('../src/services/detection-service', () => {
    return jest.fn().mockImplementation(() => ({
        // Мок-метод analyzeFile
        analyzeFile: jest.fn(async (meta) => {
            // Симуляция успешной классификации для тестов
            if (meta.relativePath.includes('invoice')) {
                return { classification: 'Document', confidenceScore: 0.95, reason: 'Mock: Invoice' };
            }
            if (meta.relativePath.includes('photo')) {
                return { classification: 'Image', confidenceScore: 0.9, reason: 'Mock: Image' };
            }
            return { classification: 'Unknown', confidenceScore: 0.5, reason: 'Mock: Unknown' };
        })
    }));
});

describe('MigrationEngine', () => {
    let mockRcloneTools;
    let mockDetectionService;
    let engine;

    beforeEach(() => {
        // Настройка моков перед каждым тестом
        mockRcloneTools = { getOnlyDuplicateGroups: jest.fn() };
        mockDetectionService = new DetectionService(); // Используем реальный мок-инстанс
        engine = new MigrationEngine(mockRcloneTools, mockDetectionService);
        jest.clearAllMocks();
    });

    describe('extractAndStandardizeUid', () => {
        it('должен стандартизировать ID в формате ID:BS-TX123/', () => {
            const path = 'folder/ID:BS-TX123/data.json';
            expect(engine.extractAndStandardizeUid(path)).toBe('BS-TX123');
        });

        it('должен вернуть UNKNOWN_UID, если ID не найден', () => {
            const path = 'folder/plain_data.txt';
            expect(engine.extractAndStandardizeUid(path)).toBe('UNKNOWN_UID');
        });
        
        it('должен обрабатывать другие, невалидные ID форматы', () => {
            const path = 'folder/BAD-ID-format/data.json';
            expect(engine.extractAndStandardizeUid(path)).toBe('UNKNOWN_UID');
        });
    });

    describe('determineCategory', () => {
        it('должен определить Finance_Documents для "invoice" или "receipt"', () => {
            expect(engine.determineCategory('invoice_2024_123.pdf')).toBe('Finance_Documents');
            expect(engine.determineCategory('another_folder/receipt_2023.pdf')).toBe('Finance_Documents');
        });

        it('должен определить Media_Assets для "photo" или "image"', () => {
            expect(engine.determineCategory('photo_001.jpg')).toBe('Media_Assets');
        });

        it('должен определить Business_Reports для "report" или "general"', () => {
            expect(engine.determineCategory('report_general.doc')).toBe('Business_Reports');
        });

        it('должен определить Uncategorized по умолчанию', () => {
            expect(engine.determineCategory('source_file.txt')).toBe('Uncategorized');
        });
    });

    describe('runPlan', async () => {
        const mockFiles = [
            'folder/images/photo_001.jpg', 
            'folder/documents/invoice_2024_123.pdf',
            'folder/media/photo_002.png'
        ];
        const mockMetadata = {
            metadata: [
                { relativePath: mockFiles[0], modTime: '2023-05-20', isDirectory: false, rawBytes: Buffer.from('...') },
                { relativePath: mockFiles[1], modTime: '2024-12-25', isDirectory: false, rawBytes: Buffer.from('...') },
                { relativePath: mockFiles[2], modTime: '2024-01-15', isDirectory: false, rawBytes: Buffer.from('...') }
            ]
        };

        beforeEach(() => {
            // Мокирование getBatchFileMetadata
            getBatchFileMetadata.mockResolvedValue(mockMetadata);
            // Мокирование detectionService.analyzeFile
            mockDetectionService.analyzeFile.mockResolvedValue({ 
                classification: 'MockTestClass', 
                confidenceScore: 1.0, 
                reason: 'Mock success' 
            });
        });

        it('должен успешно пройти весь цикл: метаданные -> классификация -> план', async () => {
            const result = await engine.runPlan(mockFiles);

            // Проверка результата
            expect(result.plan.totalFilesProcessed).toBe(mockFiles.length);
            expect(result.plan.migrationPlan).toHaveLength(mockFiles.length);
            
            // Проверка первой записи (Photo)
            expect(result.plan.migrationPlan[0].source).toBe(mockFiles[0]);
            expect(result.plan.migrationPlan[0].standardizedUid).toBe('UNKNOWN_UID');
            expect(result.plan.migrationPlan[0].targetCategory).toBe('Media_Assets');
            expect(result.plan.migrationPlan[0].detection.classification).toBe('MockTestClass');

            // Проверка второй записи (Invoice)
            expect(result.plan.migrationPlan[1].standardizedUid).toBe('BS-UNKNOWN_UID'); // ID parsing might be complex, but testing the structure
            expect(result.plan.migrationPlan[1].targetCategory).toBe('Finance_Documents');
            
            // Проверка отчетов
            expect(result.reports).toHaveLength(mockFiles.length);
        });
    });
});