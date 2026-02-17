const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');

const { adminUser, users, artists, albums, tracks, playlists, moods } = require('./seedData');

const MONGO_URI = 'mongodb://localhost:27017';
const MONGO_DB = 'musikempfehlung';
const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASS = 'neo4jpassword';

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding startet...\n');

  // ══════════════════════════════════════════════════════════════════════════════
  // MONGODB
  // ══════════════════════════════════════════════════════════════════════════════

  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db(MONGO_DB);
  console.log(`✅ MongoDB verbunden: ${MONGO_DB}\n`);

  // Drop existing collections
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).drop();
  }

  // Insert data
  await db.collection('users').insertMany([adminUser, ...users]);
  await db.collection('artists').insertMany(artists);
  await db.collection('albums').insertMany(albums);
  await db.collection('tracks').insertMany(tracks);
  await db.collection('playlists').insertMany(playlists);
  await db.collection('moods').insertMany(moods);

  console.log(`  ✅ ${users.length + 1} Users (inkl. Admin)`);
  console.log(`  ✅ ${artists.length} Artists`);
  console.log(`  ✅ ${albums.length} Albums`);
  console.log(`  ✅ ${tracks.length} Tracks`);
  console.log(`  ✅ ${playlists.length} Playlists`);
  console.log(`  ✅ ${moods.length} Moods\n`);

  await mongoClient.close();

  // ══════════════════════════════════════════════════════════════════════════════
  // NEO4J
  // ══════════════════════════════════════════════════════════════════════════════

  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
  const session = driver.session();
  console.log(`✅ Neo4j verbunden: ${NEO4J_URI}\n`);

  // Clear existing data
  await session.run('MATCH (n) DETACH DELETE n');

  // Create Users
  for (const u of [adminUser, ...users]) {
    await session.run(
      'CREATE (u:User {userId: $userId})',
      { userId: u.userId }
    );
  }

  // Create Artists
  for (const a of artists) {
    await session.run(
      'CREATE (a:Artist {artistId: $artistId})',
      { artistId: a.artistId }
    );
  }

  // Create Tracks
  for (const t of tracks) {
    await session.run(
      'CREATE (t:Track {trackId: $trackId})',
      { trackId: t.trackId }
    );
  }

  // Create Moods (from predefined list with Ids)
  for (const m of moods) {
    await session.run(
      'MERGE (m:Mood {moodId: $moodId})',
      { moodId: m.moodId }
    );
  }

  // Create PERFORMED_BY relationships (Track -> Artist)
  for (const t of tracks) {
    await session.run(
      `MATCH (t:Track {trackId: $trackId}), (a:Artist {artistId: $artistId})
       CREATE (t)-[:PERFORMED_BY]->(a)`,
      { trackId: t.trackId, artistId: t.artistId }
    );
  }

  // Create HAS_MOOD relationships (Track -> Mood)
  const allMoods = moods; // from seedData
  for (const t of tracks) {
    const moodList = Array.isArray(t.mood) ? t.mood : [t.mood];
    for (const moodName of moodList) {
      const moodObj = allMoods.find(m => m.name === moodName);
      if (moodObj) {
        await session.run(
          `MATCH (t:Track {trackId: $trackId}), (m:Mood {moodId: $moodId})
           CREATE (t)-[:HAS_MOOD]->(m)`,
          { trackId: t.trackId, moodId: moodObj.moodId }
        );
      }
    }
  }

  // Create some initial LIKES (User -> Track)
  const initialLikes = [
    { userId: 'user_001', trackId: 'trk_001' },
    { userId: 'user_001', trackId: 'trk_002' },
    { userId: 'user_001', trackId: 'trk_010' },
    { userId: 'user_002', trackId: 'trk_003' },
    { userId: 'user_002', trackId: 'trk_012' },
    { userId: 'user_002', trackId: 'trk_019' },
    { userId: 'user_003', trackId: 'trk_004' },
    { userId: 'user_003', trackId: 'trk_005' },
    { userId: 'user_004', trackId: 'trk_009' },
    { userId: 'user_004', trackId: 'trk_015' },
    { userId: 'user_005', trackId: 'trk_010' },
    { userId: 'user_005', trackId: 'trk_016' },
    { userId: 'user_005', trackId: 'trk_020' },
  ];

  for (const like of initialLikes) {
    await session.run(
      `MATCH (u:User {userId: $userId}), (t:Track {trackId: $trackId})
       CREATE (u)-[:LIKES]->(t)`,
      like
    );
  }

  console.log('  ✅ Neo4j – Graph gefüllt (Nodes + Relationships)');

  await session.close();
  await driver.close();

  console.log('\n🎉 Seeding abgeschlossen!\n');
}

seed()
  .catch(e => console.error('❌ Fehler beim Seeding:', e))
  .finally(() => process.exit());
