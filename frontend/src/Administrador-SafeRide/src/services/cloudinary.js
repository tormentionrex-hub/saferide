const CLOUD_NAME = "do2ccwxm3";
const UPLOAD_PRESET = "Safe_ride";
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/**
 * Sube una imagen a Cloudinary (Versión Web).
 * 
 * @param {File} file - El archivo obtenido desde un input type="file"
 * @returns {Promise<string>} - La URL segura de la imagen subida
 */
export const InsertarEnCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);

    try {
        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Error al subir a Cloudinary');
        }

        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Error en Cloudinary:', error);
        throw error;
    }
};
