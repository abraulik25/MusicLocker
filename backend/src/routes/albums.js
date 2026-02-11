const express = require('express');
const router = express.Router();
const { getDb } = require('../config/mongo');
const { authenticate } = require('../middleware/authMiddleware');

// GET all (optional artistId filter)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.artistId) filter.artistId = req.query.artistId;
    const albums = await getDb().collection('albums').find(filter).toArray();
    res.json(albums);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET by albumId
router.get('/:albumId', async (req, res) => {
  try {
    const album = await getDb().collection('albums').findOne({ albumId: req.params.albumId });
    if (!album) return res.status(404).json({ error: 'Album nicht gefunden' });
    res.json(album);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST (requires authentication)
router.post('/', authenticate, async (req, res) => {
  try {
    const { artistId, title, releaseYear, genre, trackCount, duration_min } = req.body;
    if (!artistId || !title) return res.status(400).json({ error: 'artistId und title erforderlich' });

    // Check for duplicate album (same title + artist, case-insensitive)
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await getDb().collection('albums').findOne({
      title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') },
      artistId: artistId
    });

    if (existing) {
      return res.status(400).json({ error: `Album "${title}" von diesem Künstler existiert bereits` });
    }

    const albumId = 'alb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const doc = {
      albumId,
      artistId,
      title,
      releaseYear: releaseYear || null,
      genre: genre || '',
      trackCount: trackCount || 0,
      duration_min: duration_min || 0,
      createdBy: req.user.userId,
      createdAt: new Date()
    };

    await getDb().collection('albums').insertOne(doc);
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT (requires authentication and ownership or admin)
router.put('/:albumId', authenticate, async (req, res) => {
  try {
    const album = await getDb().collection('albums').findOne({ albumId: req.params.albumId });
    if (!album) return res.status(404).json({ error: 'Album nicht gefunden' });

    // Check ownership
    const isAdmin = req.user.role === 'admin';
    const isOwner = album.createdBy === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Sie können nur Ihre eigenen Alben bearbeiten' });
    }

    const { title, releaseYear, genre, trackCount, duration_min } = req.body;
    const update = {};
    if (title) update.title = title;
    if (releaseYear !== undefined) update.releaseYear = releaseYear;
    if (genre !== undefined) update.genre = genre;
    if (trackCount !== undefined) update.trackCount = trackCount;
    if (duration_min !== undefined) update.duration_min = duration_min;

    const result = await getDb().collection('albums').findOneAndUpdate(
      { albumId: req.params.albumId },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Album nicht gefunden' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (requires authentication and ownership or admin)
router.delete('/:albumId', authenticate, async (req, res) => {
  try {
    const album = await getDb().collection('albums').findOne({ albumId: req.params.albumId });
    if (!album) return res.status(404).json({ error: 'Album nicht gefunden' });

    // Check ownership
    const isAdmin = req.user.role === 'admin';
    const isOwner = album.createdBy === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Sie können nur Ihre eigenen Alben löschen' });
    }

    const result = await getDb().collection('albums').deleteOne({ albumId: req.params.albumId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Album nicht gefunden' });

    // Sync: Delete from Neo4j
    const { getDriver } = require('../config/neo4j');
    const session = getDriver().session();
    try {
      await session.run('MATCH (n:Album {albumId: $id}) DETACH DELETE n', { id: req.params.albumId });
      console.log(`Deleted album ${req.params.albumId} from Neo4j`);
    } catch (e) {
      console.error('Neo4j sync error:', e);
    } finally {
      await session.close();
    }

    res.json({ message: 'Album gelöscht', albumId: req.params.albumId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
