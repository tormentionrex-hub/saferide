export async function uploadToCloudinary(file) {

  const nombreCloud = "do2ccwxm3";

  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", "Safe_ride"); // tu preset
  data.append("cloud_name", nombreCloud);   // tu cloud name

  
  

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${nombreCloud}/auto/upload`,
      {
        method: "POST",
        body: data,
      }
    );

    const result = await res.json();
    return result; // aquí viene secure_url, public_id, etc.
  } catch (error) {
    console.error("Error al subir a Cloudinary:", error);
    throw error;
  }
}