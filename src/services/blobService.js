const { getContainerClient } = require('../config/azure');

/**
 * Upload file to Azure Blob Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} containerName - Container name
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Blob URL
 */
const uploadToBlob = async (fileBuffer, fileName, containerName, contentType) => {
  try {
    const containerClient = getContainerClient(containerName);
    
    // Create container if it doesn't exist
    await containerClient.createIfNotExists({
      access: 'blob',
    });

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading to blob:', error);
    throw new Error('Failed to upload file');
  }
};

/**
 * Delete file from Azure Blob Storage
 * @param {string} blobUrl - Blob URL
 * @param {string} containerName - Container name
 * @returns {Promise<boolean>}
 */
const deleteFromBlob = async (blobUrl, containerName) => {
  try {
    const containerClient = getContainerClient(containerName);
    const fileName = blobUrl.split('/').pop();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    await blockBlobClient.deleteIfExists();
    return true;
  } catch (error) {
    console.error('Error deleting from blob:', error);
    return false;
  }
};

/**
 * Get blob SAS URL (with temporary access)
 * @param {string} blobUrl - Blob URL
 * @param {string} containerName - Container name
 * @param {number} expiresInMinutes - Expiration time in minutes
 * @returns {Promise<string>}
 */
const getBlobSasUrl = async (blobUrl, containerName, expiresInMinutes = 60) => {
  try {
    const { BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
    const { StorageSharedKeyCredential } = require('@azure/storage-blob');
    
    const containerClient = getContainerClient(containerName);
    const fileName = blobUrl.split('/').pop();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);
    
    const permissions = BlobSASPermissions.parse('r'); // Read only
    
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: fileName,
        permissions,
        startsOn,
        expiresOn,
      },
      new StorageSharedKeyCredential(
        process.env.BLOB_ACCOUNT_NAME,
        process.env.BLOB_ACCOUNT_KEY
      )
    ).toString();
    
    return `${blockBlobClient.url}?${sasToken}`;
  } catch (error) {
    console.error('Error generating SAS URL:', error);
    return blobUrl; // Fallback to regular URL
  }
};

module.exports = {
  uploadToBlob,
  deleteFromBlob,
  getBlobSasUrl,
};