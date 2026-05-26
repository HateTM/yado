/**
 * YADO - Yandex Disk Auto-Organizer
 * Module: rrlLinkCreator
 * 
 * Provides helper functions for generating RRL (Reference Resolution Links)
 * metadata and content for duplicate detection and resolution.
 */

'use strict';

/**
 * Generates metadata for an RRL link
 * @param {string} fileName - Original filename
 * @param {string} filePath - Source path of the file
 * @param {string} destinationPath - Destination path after merge
 * @param {string} timestamp - Timestamp of the operation
 * @param {string} fileHash - File hash for verification
 * @returns {Object} Metadata object with rrlKey, filePath, timestamp, fileHash
 */
function generateLinkMetadata(fileName, filePath, destinationPath, timestamp, fileHash) {
  const rrlKey = `rrl_${fileName}_${Date.now()}`;
  
  return {
    rrlKey: rrlKey,
    fileName: fileName,
    originalPath: filePath,
    destinationPath: destinationPath,
    timestamp: timestamp,
    fileHash: fileHash,
    metadata: {
      sourceFileSize: getFileSize(filePath),
      destinationFileSize: getFileSize(destinationPath),
      fileExtension: getFileExtension(fileName)
    }
  };
}

/**
 * Formats the link content for display and processing
 * @param {Object} metadata - Metadata object from generateLinkMetadata
 * @returns {Object} Formatted content with status, content, and operations
 */
function formatLinkContent(metadata) {
  const { rrlKey, originalPath, destinationPath, fileHash, metadata: meta } = metadata;
  
  return {
    rrlKey,
    status: 'pending',
    content: formatContentPath(originalPath, destinationPath, meta),
    operations: getOperations(originalPath, destinationPath, meta),
    verification: {
      fileHash: fileHash,
      contentMatch: fileHash ? 'true' : 'false'
    }
  };
}

/**
 * Gets file size from path
 * @param {string} path - File path
 * @returns {number|null} File size in bytes or null if not a file
 */
function getFileSize(path) {
  try {
    const stats = require('fs').statSync(path);
    return stats.size;
  } catch (e) {
    return null;
  }
}

/**
 * Gets file extension from filename
 * @param {string} filename - Filename
 * @returns {string} File extension with dot
 */
function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Formats the content path for display
 * @param {string} originalPath - Original file path
 * @param {string} destinationPath - Destination file path  
 * @param {Object} metadata - Metadata object
 * @returns {Object} Formatted path information
 */
function formatContentPath(originalPath, destinationPath, metadata) {
  return {
    original: originalPath,
    destination: destinationPath,
    extension: metadata.fileExtension || '',
    size: metadata.sourceFileSize || metadata.destinationFileSize || 0
  };
}

/**
 * Gets available operations for file resolution
 * @param {string} originalPath - Original file path
 * @param {string} destinationPath - Destination file path
 * @param {Object} metadata - Metadata object
 * @returns {Array} Array of available operations
 */
function getOperations(originalPath, destinationPath, metadata) {
  const operations = [];
  
  if (originalPath && require('fs').existsSync(originalPath)) {
    operations.push({
      type: 'keep_original',
      description: 'Keep original file',
      action: 'none',
      originalPath: originalPath
    });
  }
  
  if (destinationPath && require('fs').existsSync(destinationPath)) {
    operations.push({
      type: 'keep_destination',
      description: 'Keep destination file',
      action: 'none', 
      destinationPath: destinationPath
    });
  }
  
  if (originalPath && destinationPath && 
      metadata.sourceFileSize === metadata.destinationFileSize) {
    operations.push({
      type: 'duplicate',
      description: 'Both files are duplicates (same size)',
      action: 'mark_for_merge',
      originalPath: originalPath,
      destinationPath: destinationPath
    });
  }
  
  return operations;
}

/**
 * Formats content for display in terminal/CLI
 * @param {Object} formattedContent - Formatted content from formatLinkContent
 * @returns {string} Formatted string for display
 */
function formatContentForDisplay(formattedContent) {
  const { rrlKey, status, content } = formattedContent;
  
  let output = `${'='.repeat(60)}\n`;
  output += `RRL Link: ${rrlKey}\n`;
  output += `Status: ${status}\n`;
  output += `${'='.repeat(60)}\n\n`;
  output += `Content Path:\n`;
  output += `  Original: ${content.original}\n`;
  output += `  Destination: ${content.destination}\n`;
  
  if (metadata.fileExtension) {
    output += `  Extension: .${metadata.fileExtension}\n`;
  }
  if (metadata.size) {
    output += `  Size: ${metadata.size} bytes\n`;
  }
  
  output += `\nOperations:\n`;
  formattedContent.operations.forEach(op => {
    output += `  - [${op.type}] ${op.description}\n`;
  });
  
  output += `\nVerification:\n`;
  output += `  File Hash: ${formattedContent.verification.fileHash}\n`;
  output += `  Content Match: ${formattedContent.verification.contentMatch}\n`;
  output += `${'='.repeat(60)}\n`;
  
  return output;
}

module.exports = {
  generateLinkMetadata,
  formatLinkContent,
  formatContentForDisplay,
  getFileSize,
  getFileExtension,
  formatContentPath,
  getOperations
};