const express = require('express');
const router = express.Router();
const { getDb } = require('../config/mongo');
const { authenticate } = require('../middleware/authMiddleware');
const { MOODS } = require('../constants');

// GET all (optional filters: genre, mood, artistId)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.genre) filter.genre = req.query.genre;
    if (req.query.mood) filter.mood = { $in: [req.query.mood] }; // Support array search
    if (req.query.artistId) filter.artistId = req.query.artistId;
    const tracks = await getDb().collection('tracks').find(filter).toArray();
    res.json(tracks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET multiple tracks by array of IDs  →  wird vom Integration-Endpoint verwendet
router.get('/byIds/:ids', async (req, res) => {
  try {
    const idArray = req.params.ids.split(',').filter(Boolean);
    const tracks = await getDb().collection('tracks').find({ trackId: { $in: idArray } }).toArray();
    res.json(tracks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET by trackId
router.get('/:trackId', async (req, res) => {
  try {
    const track = await getDb().collection('tracks').findOne({ trackId: req.params.trackId });
    if (!track) return res.status(404).json({ error: 'Track nicht gefunden' });
    res.json(track);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST (requires authentication)
router.post('/', authenticate, async (req, res) => {
  try {
    const { albumId, artistId, title, duration_sec, genre, mood } = req.body;
    if (!title || !artistId) return res.status(400).json({ error: 'title und artistId erforderlich' });

    // Validate moods if provided (can be array or string)
    const moods = Array.isArray(mood) ? mood : (mood ? [mood] : []);
    for (const m of moods) {
      if (m && !MOODS.includes(m)) {
        return res.status(400).json({ error: `Ungültige Stimmung "${m}". Erlaubt: ${MOODS.join(', ')}` });
      }
    }

    // Check for duplicate track (same title + artist + album, case-insensitive)
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await getDb().collection('tracks').findOne({
      title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') },
      artistId: artistId,
      albumId: albumId || null
    });

    if (existing) {
      return res.status(400).json({ error: `Track "${title}" existiert bereits` });
    }

    const trackId = 'trk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const doc = {
      trackId,
      albumId: albumId || null,
      artistId,
      title,
      duration_sec: duration_sec || 0,
      genre: genre || '',
      mood: moods,  // Store as array
      createdBy: req.user.userId,
      createdAt: new Date()
    };

    await getDb().collection('tracks').insertOne(doc);

    // Auto-like: Create track node with HAS_MOOD relationships and LIKES
    try {
      const { connectNeo4j } = require('../config/neo4j');
      const driver = connectNeo4j();
      const session = driver.session();

      // Create track node
      await session.run('MERGE (t:Track {trackId: $trackId})', { trackId: trackId });

      // Create PERFORMED_BY relationship
      await session.run(
        `MATCH (t:Track {trackId: $trackId})
         MATCH (a:Artist {artistId: $artistId})
         MERGE (t)-[:PERFORMED_BY]->(a)`,
        { trackId: trackId, artistId: artistId }
      );

      // Create HAS_MOOD relationships - convert mood names to moodIds
      const allMoods = await getDb().collection('moods').find().toArray();
      for (const moodName of moods) {
        const moodObj = allMoods.find(m => m.name === moodName);
        if (moodObj) {
          await session.run(
            `MATCH (t:Track {trackId: $trackId})
             MATCH (m:Mood {moodId: $moodId})
             MERGE (t)-[:HAS_MOOD]->(m)`,
            { trackId: trackId, moodId: moodObj.moodId }
          );
        }
      }

      // Create LIKES relationship
      await session.run(
        `MATCH (u:User {userId: $userId})
         MATCH (t:Track {trackId: $trackId})
         MERGE (u)-[:LIKES]->(t)`,
        { userId: req.user.userId, trackId: trackId }
      );

      await session.close();
      console.log(`Auto-liked track ${trackId} with ${moods.length} moods for user ${req.user.userId}`);
    } catch (neo4jError) {
      console.error('Auto-like failed:', neo4jError);
      // Don't fail the request if Neo4j like fails
    }

    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT (requires authentication and ownership or admin)
router.put('/:trackId', authenticate, async (req, res) => {
  try {
    const track = await getDb().collection('tracks').findOne({ trackId: req.params.trackId });
    if (!track) return res.status(404).json({ error: 'Track nicht gefunden' });

    // Check ownership
    const isAdmin = req.user.role === 'admin';
    const isOwner = track.createdBy === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Sie können nur Ihre eigenen Tracks bearbeiten' });
    }

    const { title, duration_sec, genre, mood } = req.body;

    // Validate moods if provided
    if (mood !== undefined) {
      const moods = Array.isArray(mood) ? mood : (mood ? [mood] : []);
      for (const m of moods) {
        if (m && !MOODS.includes(m)) {
          return res.status(400).json({ error: `Ungültige Stimmung "${m}". Erlaubt: ${MOODS.join(', ')}` });
        }
      }
    }

    const update = {};
    if (title) update.title = title;
    if (duration_sec) update.duration_sec = duration_sec;
    if (genre) update.genre = genre;
    if (mood !== undefined) {
      update.mood = Array.isArray(mood) ? mood : (mood ? [mood] : []);
    }

    const result = await getDb().collection('tracks').findOneAndUpdate(
      { trackId: req.params.trackId },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Track nicht gefunden' });

    // Sync HAS_MOOD relationships to Neo4j when moods change
    if (mood !== undefined) {
      try {
        const { getDriver } = require('../config/neo4j');
        const session = getDriver().session();

        // 1. Remove all old HAS_MOOD relationships for this track
        await session.run(
          'MATCH (t:Track {trackId: $trackId})-[r:HAS_MOOD]->() DELETE r',
          { trackId: req.params.trackId }
        );

        // 2. Create new HAS_MOOD relationships based on updated mood list
        const updatedMoods = Array.isArray(mood) ? mood : (mood ? [mood] : []);
        const allMoods = await getDb().collection('moods').find().toArray();
        for (const moodName of updatedMoods) {
          const moodObj = allMoods.find(m => m.name === moodName);
          if (moodObj) {
            await session.run(
              `MATCH (t:Track {trackId: $trackId})
               MERGE (m:Mood {moodId: $moodId})
               MERGE (t)-[:HAS_MOOD]->(m)`,
              { trackId: req.params.trackId, moodId: moodObj.moodId }
            );
          }
        }

        await session.close();
        console.log(`Synced HAS_MOOD for track ${req.params.trackId}: ${updatedMoods.join(', ')}`);
      } catch (neo4jError) {
        console.error('Neo4j mood sync error:', neo4jError);
      }
    }

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (requires authentication and ownership or admin)
router.delete('/:trackId', authenticate, async (req, res) => {
  try {
    const track = await getDb().collection('tracks').findOne({ trackId: req.params.trackId });
    if (!track) return res.status(404).json({ error: 'Track nicht gefunden' });

    // Check ownership
    const isAdmin = req.user.role === 'admin';
    const isOwner = track.createdBy === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Sie können nur Ihre eigenen Tracks löschen' });
    }

    const result = await getDb().collection('tracks').deleteOne({ trackId: req.params.trackId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Track nicht gefunden' });

    // Sync: Delete from Neo4j
    const { getDriver } = require('../config/neo4j');
    const session = getDriver().session();
    try {
      await session.run('MATCH (n:Track {trackId: $id}) DETACH DELETE n', { id: req.params.trackId });
      console.log(`Deleted track ${req.params.trackId} from Neo4j`);
    } catch (e) {
      console.error('Neo4j sync error:', e);
    } finally {
      await session.close();
    }

    res.json({ message: 'Track gelöscht', trackId: req.params.trackId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET available moods
router.get('/meta/moods', (req, res) => {
  res.json(MOODS);
});

module.exports = router;
