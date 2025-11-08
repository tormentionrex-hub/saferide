const {BlobServiceClient} = require('@azure/storage-blob');
const {DefaultAzureCredential} = require('@azure/identity');
const {SecretClient} = require('@azure/keyvault-secrets');
require('dotenv').config();

// Blob Storage Client
let blobServiceClient = null;

// Prefer explicit connection string in env: BLOB_CONNECTION_STRING
// Fallback: if AZURE_STORAGE_ACCOUNT is provided, use DefaultAzureCredential
if (process.env.BLOB_CONNECTION_STRING) {
    blobServiceClient = BlobServiceClient.fromConnectionString(process.env.BLOB_CONNECTION_STRING);
} else if (process.env.AZURE_STORAGE_ACCOUNT) {
    const accountUrl = `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`;
    const credential = new DefaultAzureCredential();
    blobServiceClient = new BlobServiceClient(accountUrl, credential);
} else {
    // Not configured; do not throw at import time, but surface clear errors when used.
    console.warn('Azure Blob Storage not configured. Set BLOB_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT in environment.');
}

const getContainerClient = (containerName) => {
    if (!blobServiceClient) {
        throw new Error('Azure Blob Storage client not configured. Set BLOB_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT.');
    }
    return blobServiceClient.getContainerClient(containerName);
};

// Key Vault Client

let secretClient = null;
if (process.env.KEY_VAULT_URL) {
    const credential = new DefaultAzureCredential();
    secretClient = new SecretClient(process.env.KEY_VAULT_URL, credential);
}

const getSecret = async (secretName) => {
    if (!secretClient) {
        throw new Error('Key Vault not configured.');
    }
    const secret = await secretClient.getSecret(secretName);
    return secret.value;
};
module.exports = {
    blobServiceClient,
    getContainerClient,
    getSecret,
};