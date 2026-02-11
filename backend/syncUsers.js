const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');

const MONGO_URI = 'mongodb://localhost:27017';
const MONGO_DB = 'musikempfehlung';
const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASS = 'neo4jpassword';

async function sync() {
    console.log('🔄 Sychronizing Users from MongoDB to Neo4j...');

    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(MONGO_DB);
    const users = await db.collection('users').find().toArray();
    console.log(`✅ Found ${users.length} users in MongoDB`);

    const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
    const session = driver.session();

    let count = 0;
    for (const u of users) {
        try {
            await session.run(
                'MERGE (u:User {userId: $userId}) SET u.name = $name',
                { userId: u.userId, name: u.name }
            );
            process.stdout.write('.');
            count++;
        } catch (e) {
            console.error(`\n❌ Failed to sync user ${u.userId}:`, e.message);
        }
    }

    console.log(`\n✅ Synced ${count} users to Neo4j.`);

    await session.close();
    await driver.close();
    await mongoClient.close();
}

sync().catch(console.error);
