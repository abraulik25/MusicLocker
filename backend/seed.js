
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');
require('dotenv').config();
const { adminUser, users, artists, albums, tracks, playlists, moods } = require('./src/seedData');

async function seed() {
    console.log('🌱 Starting seed...');

    // 1. Connect MongoDB
    const mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db('musikempfehlung');
    console.log('✅ MongoDB connected');

    // 2. Connect Neo4j
    const driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASS)
    );
    const session = driver.session();
    console.log('✅ Neo4j connected');

    try {
        // ── CLEANUP (Optional: set to false to keep data) ──
        const CLEANUP = true;
        if (CLEANUP) {
            console.log('🧹 Cleaning up old data...');

            // Mongo
            await db.collection('users').deleteMany({});
            await db.collection('artists').deleteMany({});
            await db.collection('albums').deleteMany({});
            await db.collection('tracks').deleteMany({});
            await db.collection('playlists').deleteMany({});
            await db.collection('moods').deleteMany({});

            // Neo4j
            await session.run('MATCH (n) DETACH DELETE n');
            console.log('✨ Database clean');
        }

        // ── INSERT USER (Admin fix) ──
        // If admin already exists (we ignored cleanup or it was re-run), we might skip or update.
        // For now, we perform direct inserts assuming cleanup.

        // Check if admin exists in config (initAdmin uses dynamic ID). 
        // We will force use our seed data admin for consistency in this demo.
        // But initAdmin.js might have created one with different ID. 
        // We will just insert our admin from seedData. 
        // If you log in as 'admin@melodygraph.com', you'll match this one.

        // Insert Users
        const allUsers = [adminUser, ...users];
        await db.collection('users').insertMany(allUsers);
        console.log(`👤 Inserted ${allUsers.length} users`);

        // Neo4j Users
        for (const u of allUsers) {
            await session.run('MERGE (u:User {userId: $userId})', { userId: u.userId });
        }

        // Insert Artists
        await db.collection('artists').insertMany(artists);
        console.log(`🎤 Inserted ${artists.length} artists`);

        for (const a of artists) {
            await session.run('MERGE (a:Artist {artistId: $artistId})', { artistId: a.artistId });
        }

        // Insert Albums
        if (albums.length > 0) {
            await db.collection('albums').insertMany(albums);
            console.log(`💿 Inserted ${albums.length} albums`);
        }

        // Insert Moods
        await db.collection('moods').insertMany(moods);
        console.log(`🎭 Inserted ${moods.length} moods`);

        for (const m of moods) {
            await session.run('MERGE (m:Mood {moodId: $moodId})', { moodId: m.moodId });
        }

        // Insert Tracks
        await db.collection('tracks').insertMany(tracks);
        console.log(`🎵 Inserted ${tracks.length} tracks`);

        // Neo4j Tracks & Relations
        for (const t of tracks) {
            // Track Node
            await session.run('MERGE (t:Track {trackId: $trackId})', { trackId: t.trackId });

            // Performed By
            await session.run(`
        MATCH (t:Track {trackId: $trackId})
        MATCH (a:Artist {artistId: $artistId})
        MERGE (t)-[:PERFORMED_BY]->(a)
      `, { trackId: t.trackId, artistId: t.artistId });

            // Has Mood
            if (t.mood) {
                // t.mood is array of names in seedData? Yes ['Energetic', 'Mysterious']
                // We need to map names to IDs or match by property? 
                // Neo4j schema uses moodId usually. 
                // seedData has mood names string array in tracks, but mood objects have moodId.
                // We need to look up moodId by name.

                for (const moodName of t.mood) {
                    const moodObj = moods.find(m => m.name === moodName);
                    if (moodObj) {
                        await session.run(`
              MATCH (t:Track {trackId: $trackId})
              MATCH (m:Mood {moodId: $moodId})
              MERGE (t)-[:HAS_MOOD]->(m)
            `, { trackId: t.trackId, moodId: moodObj.moodId });
                    }
                }
            }
        }

        // Insert Playlists
        await db.collection('playlists').insertMany(playlists);
        console.log(`📋 Inserted ${playlists.length} playlists`);

        // ── RELATIONSHIPS (Follows & Likes) ──
        for (const u of allUsers) {
            // FOLLOWS
            if (u.following && u.following.length > 0) {
                for (const targetId of u.following) {
                    await session.run(`
            MATCH (u1:User {userId: $u1})
            MATCH (u2:User {userId: $u2})
            MERGE (u1)-[:FOLLOWS]->(u2)
          `, { u1: u.userId, u2: targetId });
                }
            }

            // LIKES (New!)
            if (u.likedTracks && u.likedTracks.length > 0) {
                for (const trackId of u.likedTracks) {
                    await session.run(`
            MATCH (u:User {userId: $userId})
            MATCH (t:Track {trackId: $trackId})
            MERGE (u)-[:LIKES]->(t)
          `, { userId: u.userId, trackId: trackId });
                }
            }
        }

        console.log('✅ Seed complete!');

    } catch (e) {
        console.error('❌ Seed error:', e);
    } finally {
        await mongoClient.close();
        await session.close();
        await driver.close();
    }
}

seed();
