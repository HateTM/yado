const { MigrationEngine } = require("../src/engine/migration-engine.js");
const FileSystem = require("../src/utils/file-system.js");
import { DetectionService } from "../src/services/detection-service.js";

// Mocking external dependencies (rcloneTools and DetectionService)
// for isolated unit testing of MigrationEngine logic.
const mockRcloneTools = {
  getAllFilePaths: jest.fn(() =>
    Promise.resolve({
      allFilePaths: [
        "rclone/ProjectA/client/src/components/Button.tsx",
        "rclone/ProjectA/data/raw/dump.log",
        "rclone/ProjectA/report/report_q1_2025.docx",
        "rclone/ProjectA/data/duplicate_files/original.txt",
        "rclone/ProjectB/subdir/temp_logs/2024.log",
        "rclone/ProjectA/client/", // Directory simulation
      ],
    }),
  ),
};

// Mocking detection service response
const mockDetectionService = {
  generateReport: jest.fn(() =>
    Promise.resolve({
      results: [
        {
          classification: "Code",
          confidenceScore: 0.95,
          reason:
            "Обнаружены маркеры кода, характерные для исходных файлов (e.g., .tsx, .js).",
        },
      ],
    }),
  ),
};

describe("MigrationEngine Core Logic Tests", () => {
  let engine;

  // Setup mocks before each test
  beforeAll(() => {
    // Mocking the global rcloneTools for the test suite
    jest.mock("../rcloneTools.js", () => ({
      rcloneTools: mockRcloneTools,
    }));

    // Mocking the DetectionService for the test suite
    jest.mock("../services/detection-service.js", () => ({
      DetectionService: jest.fn(() => ({
        generateReport: mockDetectionService.generateReport,
      })),
    }));

    engine = new MigrationEngine();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =================================================================
  // 1. Test extractAndStandardizeUid (ID Parsing)
  // =================================================================
  describe("extractAndStandardizeUid", () => {
    it("should standardize a clear ProjectA path", () => {
      const path = "rclone/ProjectA/client/src/components/Button.tsx";
      expect(engine.extractAndStandardizeUid(path)).toBe("BS-A-01");
    });

    it("should standardize a clear ProjectB path", () => {
      const path = "rclone/ProjectB/api/v1/user.api";
      expect(engine.extractAndStandardizeUid(path)).toBe("BS-B-01");
    });

    it("should handle deep, ambiguous paths and return fallback", () => {
      // This path doesn't match the strict ProjectA/ProjectB format
      const path = "rclone/SomeOtherProject/data/file.txt";
      // Fallback should capture 'file' -> 'FI'
      expect(engine.extractAndStandardizeUid(path)).toMatch(
        /^BS-UNKNOWN-[A-Z]{2}$/,
      );
    });

    it("should handle the complex path structure used in the provided test case", () => {
      const path = "rclone/ProjectA/data/duplicate_files/original.txt";
      // The regex matches ProjectA and 'original' -> 'RG'
      expect(engine.extractAndStandardizeUid(path)).toBe("BS-A-RG");
    });
  });

  // =================================================================
  // 2. Test determineCategory (Categorization)
  // =================================================================
  describe("determineCategory", () => {
    it("should categorize reports correctly", () => {
      expect(engine.determineCategory("report_q1_2025.docx")).toBe(
        "ReportArchive",
      );
    });

    it("should categorize data/dataset folders correctly", () => {
      expect(engine.determineCategory("dataset")).toBe("CoreDataWarehouse");
    });

    it("should categorize source code folders correctly", () => {
      expect(engine.determineCategory("src")).toBe("SourceCodeRepository");
    });

    it("should categorize client/api folders correctly", () => {
      expect(engine.determineCategory("client")).toBe("MicroserviceAssets");
    });

    it("should use the general fallback category", () => {
      expect(engine.determineCategory("random_folder")).toBe("GeneralAssets");
    });
  });

  // =================================================================
  // 3. Test runPlan (End-to-End Orchestration)
  // =================================================================
  describe("runPlan", () => {
    it("should run through all stages and generate a complete MigrationPlan", async () => {
      // Mocking file system and detection service to ensure predictable test outcomes
      jest
        .spyOn(FileSystem, "getFileMetadata")
        .mockImplementation(async (path) => {
          const isDir = path.includes("rclone/subdir");
          return {
            fullPath: path,
            relativePath: path.replace(/rclone\//, ""),
            modTime: "2025-01-15",
            isDirectory: isDir,
            rawBytes: isDir
              ? ""
              : path.includes("code")
                ? "SIMULATED_RAW_BYTES_FOR_Code"
                : "SIMULATED_RAW_BYTES_for_Image",
          };
        });

      // Mock the entire rcloneTools dependency
      mockRcloneTools.getAllFilePaths.mockResolvedValue({
        allFilePaths: [
          "rclone/ProjectA/client/src/components/Button.tsx", // Code
          "rclone/ProjectA/data/raw/dump.log", // RawData
          "rclone/ProjectA/report/report_q1_2025.docx", // Document
          "rclone/ProjectA/data/duplicate_files/original.txt", // Code
          "rclone/ProjectA/client/", // Directory
        ],
      });

      // Overwrite the mocked detection service to ensure predictable results for the test
      const mockGenerateReport = jest.fn(async (batch) => {
        const file = batch[0];
        if (file.rawBytes.includes("Code")) {
          return {
            results: [
              { classification: "Code", confidenceScore: 0.95, reason: "Code" },
            ],
          };
                } else if (file.rawBytes.includes("Image")) {
                    return {
                        results: [
                            {
                                classification: "Image",
                                confidenceScore: 0.85,
                                reason: "Image",
                            },
                        ],
                    };
                } else if (file.rawBytes.includes("dump")) {
                    return {
                        results: [
                            {
                                classification: "RawData",
                                confidenceScore: 0.9,
                                reason: "Raw",
                            },
                        ],
                    };
                } else if (file.rawBytes.includes("report")) {
                    return {
                        results: [
                            {
                                classification: "Document",
                                confidenceScore: 0.9,
                                reason: "Document",
                            },
                        ],
                    };
                } else {
                    return { results: [] };
                }

      });
      mockDetectionService.generateReport = mockGenerateReport;

      const plan = await engine.runPlan();

      // Assertions
      expect(plan).toHaveProperty("generationDate");
      expect(plan.totalItems).toBe(5); // 4 files + 1 directory
      expect(plan.fileAnalysisResults.length).toBe(5);

      // Verify the first file's analysis structure (Button.tsx)
      const buttonFile = plan.fileAnalysisResults[0];
      expect(buttonFile.relativePath).toBe("client/src/components/Button.tsx");
      expect(buttonFile.standardizedUid).toBe("BS-A-CO"); // From ProjectA and Button (BN) -> BS-A-CO (based on the test logic approximation)
      expect(buttonFile.targetCategory).toBe("SourceCodeRepository");
      expect(buttonFile.detectionReport.results[0].classification).toBe("Code");

      // Verify the directory structure was handled (client/)
      const directoryItem = plan.fileAnalysisResults[4];
      expect(directoryItem.relativePath).toBe("client/");
      expect(directoryItem.detectionReport.results).toHaveLength(0);
      expect(directoryItem.metadata.isDirectory).toBe(true);
    });
  });
});
