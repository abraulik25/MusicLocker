const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function syncFollows() {
    console.log('🔄 Starting Follow Sync...');

    const mongoClient = new MongoClient(process.env.MONGO_URI);
    const driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASS)
    );
    const session = driver.session();

    try {
        await mongoClient.connect();
        const db = mongoClient.db('musikempfehlung');
        const users = await db.collection('users').find().toArray();

        console.log(`Found ${users.length} users in MongoDB.`);

        let addedCount = 0;

        for (const user of users) {
            if (user.following && user.following.length > 0) {
                for (const targetId of user.following) {
                    // MERGE prevents duplicates
                    await session.run(`
                        MATCH (u1:User {userId: $u1})
                        MATCH (u2:User {userId: $u2})
                        MERGE (u1)-[r:FOLLOWS]->(u2)
                        RETURN type(r)
                     `, { u1: user.userId, u2: targetId });
                    addedCount++;
                }
            }
        }

        console.log(`✅ Sync complete. Ensured ${addedCount} follow relationships exist.`);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await session.close();
        await driver.close();
        await mongoClient.close();
    }
}

syncFollows();
