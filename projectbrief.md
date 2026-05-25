# Project Brief: Advanced Workflow Orchestration with Rclone Integration

## 🎯 Core Goal
The primary objective of this project is to build an advanced, multi-step orchestration system that combines local resource management (via `rclone`) with sophisticated LLM decision-making (via `agentPrompt.js` and `index.js`). The system aims to automate complex data governance tasks, specifically addressing the detection and resolution of duplicate or redundant files in large, distributed storage systems.

## 🚀 Key Capabilities
1. **Cloud File System Management (rclone)**:
   - Provides robust, scriptable tools for interacting with various cloud storage platforms (e.g., Google Drive, S3) using `rclone`.
   - Core functions include full synchronization (`rclone sync`), reliable copying, detailed listing, and metadata inspection (`rclone lsjson`).
2. **Duplicate Detection and Deduplication (LLM-Guided)**:
   - Implements a sophisticated, multi-stage workflow to identify potential duplicates across a vast set of files.
   - **Workflow**:
     1. **Discovery**: Scan files using hashing mechanisms (MD5) via `rcloneTools` to group potential duplicate records.
     2. **Structuring**: Format the raw duplicate data into a structured JSON payload (`buildPromptPayload`).
     3. **Decision Making**: Pass the payload to a powerful LLM agent, which is tasked with making a critical, informed decision: identifying the single "best" or most canonical version of the file that should be retained, and listing all other relative paths that must be deleted.
     4. **Execution**: Execute the final, confirmed actions (e.g., `rclone deletefile` or `rclone sync`) based solely on the LLM's high-confidence decision.
3. **Orchestration and Extensibility**:
   - The `index.js` acts as the central controller, managing the entire multi-step lifecycle (Discovery $\rightarrow$ Decision $\rightarrow$ Execution).
   - The system is designed to be modular, allowing easy integration of new resource types or different operational logic blocks.

## 💡 Success Metrics and Scope Definition
* **Automation Depth**: The system must move beyond simple file operations and automate the *decision-making* process, mimicking human expert judgment to minimize manual intervention and data loss.
* **Reliability**: The final execution step must rely on the LLM's decision, mitigating the risk of arbitrary file deletion or incorrect syncing.
* **Scale**: The architecture must be designed to handle petabyte-scale datasets, necessitating efficient metadata handling and chunking of input data.

