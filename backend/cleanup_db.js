const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb://127.0.0.1:27017";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected correctly to server");
    const db = client.db("Safe-RideDB");
    const users = db.collection("users");

    // Limpiar campos de imagen que contengan "cloudinary"
    const result = await users.updateMany(
      { 
        $or: [
          { profileImage: { $regex: /cloudinary/i } }, 
          { photo: { $regex: /cloudinary/i } }
        ] 
      }, 
      { 
        $set: { 
          profileImage: null, 
          photo: null 
        } 
      }
    );

    console.log(`Matched ${result.matchedCount} documents and modified ${result.modifiedCount} documents.`);
  } catch (err) {
    console.error("Error during cleanup:", err);
  } finally {
    await client.close();
  }
}

main();
