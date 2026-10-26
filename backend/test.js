const { MongoClient } = require('mongodb');

async function listDbs() {
    const uri = 'mongodb://127.0.0.1:27017/';
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbs = await client.db('admin').admin().listDatabases();
        console.log('Databases:', dbs.databases.map(db => db.name));
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
        process.exit(0);
    }
}

listDbs();
