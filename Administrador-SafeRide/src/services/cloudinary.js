const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = CLOUD_NAME && UPLOAD_PRESET
    ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    : null;

/**
 * Sube una imagen a Cloudinary (Versión Web).
 * 
 * @param {File} file - El archivo obtenido desde un input type="file"
 * @returns {Promise<string>} - La URL segura de la imagen subida
 */
export const InsertarEnCloudinary = async (file) => {
    if (!UPLOAD_URL) {
        throw new Error('Faltan VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET');
    }
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
