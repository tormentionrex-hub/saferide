const {BlobServiceClient} = require('@azure/storage-blob');
const {DefaultAzureCredential} = require('@azure/identity');
const {SecretClient} = require('@azure/keyvault-secrets');
require('dotenv').config();

// Blob Storage Client
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.BLOB_CONNECTION_STRING);

const getContainerClient = (containerName) => {
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