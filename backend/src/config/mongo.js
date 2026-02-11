const { MongoClient } = require('mongodb');
require('dotenv').config();

let client;
let db;

async function connectMongo() {
  try {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db('musikempfehlung');
    console.log('✅ MongoDB verbunden:', process.env.MONGO_URI);
    return db;
  } catch (err) {
    console.error('❌ MongoDB Verbindungsfehler:', err.message);
    throw err;
  }
}

function getDb() {
  if (!db) throw new Error('MongoDB nicht verbunden');
  return db;
}

module.exports = { connectMongo, getDb };
