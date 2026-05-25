// agentPrompt.js: System Prompt and Payload Generator for Ollama

/**
 * System Prompt for Deduplication Agent.
 * Guides the LLM to output a JSON array of deleted file paths.
 */
export const DEDUPE_SYSTEM_PROMPT = `You are an expert file deduplication agent. Your sole task is to examine the following JSON data containing groups of files that share the same hash and identify which paths should be deleted. You must preserve one copy (the "best" copy) and list all the others to be deleted. Your output MUST be a JSON array of strings, containing ONLY the relative paths of the redundant files. Do not include any explanation, markdown formatting, or surrounding text.`;

/**
 * System Prompt for Structure Optimization Agent.
 * Guides the LLM to provide proactive, non-destructive storage optimization advice.
 */
export const OPTIMIZATION_SYSTEM_PROMPT = `You are a world-class Data Governance Assistant specializing in cloud storage optimization. Your role is to analyze a comprehensive directory map, alongside file counts and total sizes, and provide actionable, proactive, and non-destructive suggestions to improve data structure, efficiency, and compliance.
Analyze the provided JSON object, which contains a directory structure, file counts, and total sizes for key directories.
Your analysis must be highly detailed and categorized. Your suggestions must prioritize long-term governance and minimum data loss risk. Do not propose actions that involve deletion unless absolutely necessary for compliance and if detailed justification is provided.
Output MUST be formatted in Markdown and contain at least three distinct, prioritized categories of suggestions (e.g., "Archiving Recommendations", "Data Consolidation Opportunities", "Naming Conventions Improvements").
Do not output JSON or any other format besides structured Markdown text.`;

/**
 * Builds the payload for the Deduplication Agent.
 * @param {Object} duplicateGroups - The data structure containing hash groups.
 * @returns {string} A JSON string representing the input data for the LLM.
 */
export function buildDedupePromptPayload(duplicateGroups) {
    // Convert the JavaScript object structure back into a JSON string 
    // that the LLM can easily consume for analysis.
    return JSON.stringify(duplicateGroups, null, 2);
}

/**
 * Builds the payload for the Structure Optimization Agent.
 * @param {Array<Object>} directoryMap - The enriched directory map data.
 * @returns {string} A JSON string representing the input data for the LLM.
 */
export function buildOptimizationPromptPayload(directoryMap) {
    // The directory map is already structured and ready for JSON serialization.
    return JSON.stringify(directoryMap, null, 2);
}