const { getContainerClient, blobServiceClient } = require('../config/azure');

// Hay almacenamiento configurado (sin él, subir responde 503 claro y no 500).
const isBlobConfigured = () => !!blobServiceClient;

// Documentos de conductores (cédula, licencia, póliza...): contenedor
// PRIVADO, a diferencia de las fotos de perfil y vehículo. El panel los ve
// con una URL firmada de corta duración (getBlobSasUrl). Se aceptan imágenes
// (sin SVG) y PDF.
const DOCUMENTS_CONTAINER = 'vehicle-documents';
const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const uploadPrivateDocument = async (fileBuffer, fileName, contentType) => {
  const type = String(contentType || '').toLowerCase();
  if (!DOCUMENT_TYPES.includes(type)) {
    const err = new Error('Only JPEG, PNG, WEBP or PDF files are allowed');
    err.statusCode = 400;
    throw err;
  }
  const containerClient = getContainerClient(DOCUMENTS_CONTAINER);
  await containerClient.createIfNotExists();
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.uploadData(fileBuffer, { blobHTTPHeaders: { blobContentType: type } });
  return blockBlobClient.url;
};

/**
 * Upload file to Azure Blob Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} containerName - Container name
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Blob URL
 */

//Function to upload file to blob storage
const uploadToBlob = async (fileBuffer, fileName, containerName, contentType) => {
  // Segunda capa (las rutas ya filtran con multer): el contenedor es público,
  // así que nunca se publica algo que el navegador pueda ejecutar.
  const type = String(contentType || '').toLowerCase();
  if (!type.startsWith('image/') || type.includes('svg') || type.includes('xml')) {
    const err = new Error('Only image files are allowed');
    err.statusCode = 400;
    throw err;
  }
  try {
    const containerClient = getContainerClient(containerName);
    
    // Create container if it doesn't exist
    await containerClient.createIfNotExists({
      access: 'blob',
    });
    // Get block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    // Upload data
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

//Function to delete file from blob storage
const deleteFromBlob = async (blobUrl, containerName) => {
  try {
    const containerClient = getContainerClient(containerName);
    const fileName = blobUrl.split('/').pop();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    // Delete blob if exists
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

//Function to get blob SAS URL (with temporary access)
const getBlobSasUrl = async (blobUrl, containerName, expiresInMinutes = 60) => {
  try {
    const { BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
    const { StorageSharedKeyCredential } = require('@azure/storage-blob');
    // Get container client
    const containerClient = getContainerClient(containerName);
    const fileName = blobUrl.split('/').pop();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    // Generate SAS token
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);
    // Define permissions
    const permissions = BlobSASPermissions.parse('r'); // Read only
    // Generate SAS query parameters
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
    // Return full URL with SAS token
    return `${blockBlobClient.url}?${sasToken}`;
  } catch (error) {
    console.error('Error generating SAS URL:', error);
    return blobUrl; // Fallback to regular URL
  }
};

module.exports = {
  isBlobConfigured,
  uploadPrivateDocument,
  DOCUMENTS_CONTAINER,
  uploadToBlob,
  deleteFromBlob,
  getBlobSasUrl,
};