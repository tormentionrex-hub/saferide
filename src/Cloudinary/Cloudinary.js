const CLOUD_NAME = "do2ccwxm3";
const UPLOAD_PRESET = "Safe_ride";
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/**
 * Sube una imagen a Cloudinary usando XMLHttpRequest.
 * fetch + FormData tiene problemas conocidos con archivos locales en React Native / Expo Android.
 *
 * @param {{ uri: string, name?: string, type?: string }} file
 * @returns {Promise<{ secure_url: string, public_id: string, [key: string]: any }>}
 */
export function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        // Normalizar MIME type: image/jpg no es válido, debe ser image/jpeg
        const rawType = file.type || 'image/jpeg';
        const mimeType = rawType.replace(/\/jpg$/, '/jpeg');
        const extension = mimeType.split('/')[1] || 'jpg';
        const fileName = file.name || `upload_${Date.now()}.${extension}`;

        const data = new FormData();
        data.append('file', {
            uri: file.uri,
            type: mimeType,
            name: fileName,
        });
        data.append('upload_preset', UPLOAD_PRESET);
        data.append('cloud_name', CLOUD_NAME);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', UPLOAD_URL);

        xhr.onload = () => {
            try {
                const result = JSON.parse(xhr.responseText);
                if (result.error) {
                    reject(new Error(`[Cloudinary] ${result.error.message}`));
                } else {
                    resolve(result);
                }
            } catch (e) {
                reject(new Error('[Cloudinary] Respuesta inválida del servidor'));
            }
        };

        xhr.onerror = () => {
            reject(new Error('[Cloudinary] Error de red al subir la imagen'));
        };

        xhr.ontimeout = () => {
            reject(new Error('[Cloudinary] Timeout al subir la imagen'));
        };

        xhr.timeout = 30000; // 30 segundos máximo
        xhr.send(data);
    });
}
