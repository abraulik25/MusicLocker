require('dotenv').config({ path: '../.env' }); // Adjust path if needed, assuming run from scripts dir
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/melodygraph';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASS = process.env.NEO4J_PASSWORD || 'neo4jpassword';

async function cleanup() {
    const mongoClient = new MongoClient(MONGO_URI);
    const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
    const session = driver.session();

    try {
        console.log('🚀 Cleanup started...');

        // 1. Clean up Users
        // Get all valid User IDs from MongoDB
        await mongoClient.connect();
        const db = mongoClient.db();
        const mongoUsers = await db.collection('users').find().toArray();
        const validUserIds = new Set(mongoUsers.map(u => u.userId));

        console.log(`Phase 1: Checking ${validUserIds.size} valid users against Neo4j...`);

        // Get all User nodes from Neo4j
        const neo4jResult = await session.run('MATCH (u:User) RETURN u.userId AS userId');
        const neo4jUserIds = neo4jResult.records.map(r => r.get('userId'));

        let deletedUsers = 0;
        for (const neoUserId of neo4jUserIds) {
            if (!validUserIds.has(neoUserId)) {
                await session.run('MATCH (u:User {userId: $id}) DETACH DELETE u', { id: neoUserId });
                console.log(`   Deleted orphan user: ${neoUserId}`);
                deletedUsers++;
            }
        }
        console.log(`✅ Cleaned up ${deletedUsers} orphan users.`);

        // 2. Clean up Unused Moods (Orphans)
        // "Too many nodes" -> Delete moods that have no relationships
        console.log('Phase 2: Cleaning up unused mood nodes...');
        const moodResult = await session.run(`
      MATCH (m:Mood)
      WHERE NOT (m)--()
      DELETE m
      RETURN count(m) as count
    `);
        const deletedMoods = moodResult.records[0].get('count').toInt();
        console.log(`✅ Deleted ${deletedMoods} unused mood nodes (no connections).`);

        console.log('🎉 Cleanup finished!');
    } catch (e) {
        console.error('Error during cleanup:', e);
    } finally {
        await session.close();
        await driver.close();
        await mongoClient.close();
    }
}

cleanup();
