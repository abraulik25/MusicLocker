const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');

const MONGO_URI = 'mongodb://localhost:27017';
const MONGO_DB = 'musikempfehlung';
const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASS = 'neo4jpassword';

const newMoods = [
    { moodId: 'mood_014', name: 'Rebellious', description: 'Aufsässige, rebellische Energie', keywords: ['defiant', 'revolutionary', 'bold'], createdAt: new Date() },
    { moodId: 'mood_016', name: 'Catchy', description: 'Eingängige, mitreißende Melodien', keywords: ['memorable', 'hooky', 'infectious'], createdAt: new Date() },
    { moodId: 'mood_018', name: 'Sunny', description: 'Sonnige Stimmung', keywords: ['sun', 'warm', 'bright'], createdAt: new Date() },
    { moodId: 'mood_020', name: 'Classic', description: 'Klassische Vibes', keywords: ['traditional', 'standard'], createdAt: new Date() },
    { moodId: 'mood_021', name: 'Dramatic', description: 'Dramatisch', keywords: ['drama', 'theatrical'], createdAt: new Date() },
    { moodId: 'mood_022', name: 'Groovy', description: 'Rhythmisch, tanzbar, funkig', keywords: ['funk', 'rhythm', 'dance'], createdAt: new Date() },
    { moodId: 'mood_023', name: 'Atmospheric', description: 'Stimmungsvoll, raumfüllend', keywords: ['ambient', 'space', 'moody'], createdAt: new Date() },
    { moodId: 'mood_024', name: 'Technical', description: 'Technisch anspruchsvoll, komplex', keywords: ['complex', 'skill', 'virtuoso'], createdAt: new Date() }
];

async function migrate() {
    console.log('🚀 Migration started...');

    // 1. MongoDB Updates
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(MONGO_DB);
    console.log('✅ MongoDB connected');

    const moodCollection = db.collection('moods');

    for (const mood of newMoods) {
        const exists = await moodCollection.findOne({ name: mood.name });
        if (!exists) {
            await moodCollection.insertOne(mood);
            console.log(`   Created MongoDB mood: ${mood.name}`);
        } else {
            console.log(`   MongoDB mood already exists: ${mood.name}`);
        }
    }

    // Fetch ALL moods to sync to Neo4j
    const allMoods = await moodCollection.find().toArray();
    await mongoClient.close();

    // 2. Neo4j Updates
    const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
    const session = driver.session();
    console.log('✅ Neo4j connected');

    try {
        // Sync ALL moods to Neo4j (adds missing ones, updates existing ones with moodId)
        for (const m of allMoods) {
            await session.run(
                'MERGE (m:Mood {moodId: $moodId})',
                { moodId: m.moodId }
            );
            console.log(`   Synced Neo4j mood: ${m.name} (${m.moodId})`);
        }
        console.log('✅ Neo4j sync complete');
    } catch (error) {
        console.error('❌ Neo4j Error:', error);
    } finally {
        await session.close();
        await driver.close();
    }

    console.log('🎉 Migration finished!');
}

migrate();
