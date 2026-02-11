const express = require('express');
const router = express.Router();
const { getDb } = require('../config/mongo');
const { authenticate } = require('../middleware/authMiddleware');

// GET all (optional genre filter)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.genre) filter.genre = req.query.genre;
    const artists = await getDb().collection('artists').find(filter).toArray();
    res.json(artists);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET by artistId
router.get('/:artistId', async (req, res) => {
  try {
    const artist = await getDb().collection('artists').findOne({ artistId: req.params.artistId });
    if (!artist) return res.status(404).json({ error: 'Artist nicht gefunden' });
    res.json(artist);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST (requires authentication)
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, genre, origin, formedYear } = req.body;
    if (!name || !genre) return res.status(400).json({ error: 'Name und Genre erforderlich' });

    // Check for duplicate artist (case-insensitive)
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await getDb().collection('artists').findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ error: `Künstler "${name}" existiert bereits` });
    }

    const artistId = 'art_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const doc = {
      artistId,
      name,
      genre,
      origin: origin || '',
      formedYear: formedYear || null,
      createdBy: req.user.userId,
      createdAt: new Date()
    };

    await getDb().collection('artists').insertOne(doc);
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT (requires authentication and ownership or admin)
router.put('/:artistId', authenticate, async (req, res) => {
  try {
    const artist = await getDb().collection('artists').findOne({ artistId: req.params.artistId });
    if (!artist) return res.status(404).json({ error: 'Artist nicht gefunden' });

    // Check ownership
    const isAdmin = req.user.role === 'admin';
    const isOwner = artist.createdBy === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Sie können nur Ihre eigenen Künstler bearbeiten' });
    }

    const { name, genre, origin, formedYear } = req.body;
    const update = {};
    if (name) update.name = name;
    if (genre) update.genre = genre;
    if (origin !== undefined) update.origin = origin;
    if (formedYear !== undefined) update.formedYear = formedYear;

    const result = await getDb().collection('artists').findOneAndUpdate(
      { artistId: req.params.artistId },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Artist nicht gefunden' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (requires authentication and ownership or admin)
router.delete('/:artistId', authenticate, async (req, res) => {
  try {
    const artist = await getDb().collection('artists').findOne({ artistId: req.params.artistId });
    if (!artist) return res.status(404).json({ error: 'Artist nicht gefunden' });

    // Check ownership
    const isAdmin = req.user.role === 'admin';
    const isOwner = artist.createdBy === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Sie können nur Ihre eigenen Künstler löschen' });
    }

    const result = await getDb().collection('artists').deleteOne({ artistId: req.params.artistId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Artist nicht gefunden' });

    // Sync: Delete from Neo4j
    const { getDriver } = require('../config/neo4j');
    const session = getDriver().session();
    try {
      await session.run('MATCH (n:Artist {artistId: $id}) DETACH DELETE n', { id: req.params.artistId });
      console.log(`Deleted artist ${req.params.artistId} from Neo4j`);
    } catch (e) {
      console.error('Neo4j sync error:', e);
    } finally {
      await session.close();
    }

    res.json({ message: 'Artist gelöscht', artistId: req.params.artistId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
