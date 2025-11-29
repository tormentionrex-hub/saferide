const {BlobServiceClient} = require('@azure/storage-blob');
const {DefaultAzureCredential} = require('@azure/identity');
const {SecretClient} = require('@azure/keyvault-secrets');
require('dotenv').config();

// Blob Storage Client
let blobServiceClient = null;

// Check for connection string in environment variables
const connectionString = process.env.BLOB_STORAGE_CONNECTION_STRING || process.env.BLOB_CONNECTION_STRING;
// Initialize BlobServiceClient
if (connectionString) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
} else if (process.env.AZURE_STORAGE_ACCOUNT) {
    const accountUrl = `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`;
    const credential = new DefaultAzureCredential();
    blobServiceClient = new BlobServiceClient(accountUrl, credential);
} else {
    console.warn('Azure Blob Storage not configured. Set BLOB_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT in environment.');
}
// Function to get container client
const getContainerClient = (containerName) => {
    if (!blobServiceClient) {
        throw new Error('Azure Blob Storage client not configured. Set BLOB_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT.');
    }
    return blobServiceClient.getContainerClient(containerName);
};

// Key Vault Client
// Initialize SecretClient if KEY_VAULT_URL is provided
let secretClient = null;
if (process.env.KEY_VAULT_URL) {
    const credential = new DefaultAzureCredential();
    secretClient = new SecretClient(process.env.KEY_VAULT_URL, credential);
}
// Function to get secret from Key Vault
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