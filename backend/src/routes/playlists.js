const express = require('express');
const router = express.Router();
const { getDb } = require('../config/mongo');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// GET (scoped)
router.get('/', authenticate, async (req, res) => {
  try {
    const scope = req.query.scope || 'mine';
    let filter = {};

    if (scope === 'mine') {
      // Show only playlists created by the current user
      filter = { createdBy: req.user.userId };
    } else if (scope === 'all' && req.user.role === 'admin') {
      // Admins can see all playlists
      filter = {};
    } else {
      // Default to mine for non-admin
      filter = { createdBy: req.user.userId };
    }

    const playlists = await getDb().collection('playlists').find(filter).toArray();
    res.json(playlists);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/playlists/following/all - Get public playlists from users you follow
router.get('/following/all', authenticate, async (req, res) => {
  try {
    const currentUser = await getDb().collection('users').findOne({ userId: req.user.userId });
    const following = currentUser?.following || [];
    if (following.length === 0) return res.json([]);

    const playlists = await getDb().collection('playlists').find({
      createdBy: { $in: following },
      isPublic: true
    }).toArray();

    res.json(playlists);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/playlists/discover/all - Get public playlists from users you don't follow
router.get('/discover/all', authenticate, async (req, res) => {
  try {
    const currentUser = await getDb().collection('users').findOne({ userId: req.user.userId });
    const following = currentUser?.following || [];

    const playlists = await getDb().collection('playlists').find({
      createdBy: { $nin: [...following, req.user.userId] },
      isPublic: true
    }).toArray();

    res.json(playlists);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /aggregated/:playlistId
router.get('/aggregated/:playlistId', authenticate, async (req, res) => {
  try {
    const playlist = await getDb().collection('playlists').findOne({ playlistId: req.params.playlistId });
    if (!playlist) return res.status(404).json({ error: 'Playlist nicht gefunden' });

    const tracks = await getDb().collection('tracks').find({
      trackId: { $in: playlist.trackIds || [] }
    }).toArray();

    res.json({ ...playlist, tracks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST (create new playlist)
router.post('/', authenticate, async (req, res) => {
  try {
    const { userId, name, trackIds, description, isPublic } = req.body;
    if (!name) return res.status(400).json({ error: 'name erforderlich' });

    // Use authenticated user's ID
    const playlistUserId = userId || req.user.userId;

    // Non-admins can only create playlists for themselves
    if (req.user.role !== 'admin' && playlistUserId !== req.user.userId) {
      return res.status(403).json({ error: 'Sie können nur Playlists für sich selbst erstellen' });
    }

    const playlistId = 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const doc = {
      playlistId,
      userId: playlistUserId,
      name,
      description: description || '',
      trackIds: trackIds || [],
      isPublic: isPublic !== undefined ? isPublic : false, // Default to private
      createdBy: req.user.userId,
      createdAt: new Date()
    };

    await getDb().collection('playlists').insertOne(doc);
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT (update playlist - requires ownership or admin)
router.put('/:playlistId', authenticate, async (req, res) => {
  try {
    const playlist = await getDb().collection('playlists').findOne({ playlistId: req.params.playlistId });
    if (!playlist) return res.status(404).json({ error: 'Playlist nicht gefunden' });

    // Check ownership
    const isAdmin = req.user.role === 'admin';
    const isOwner = playlist.createdBy === req.user.userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Nur der Ersteller oder ein Admin kann diese Playlist bearbeiten' });
    }

    const { name, description, trackIds, isPublic } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (trackIds) updates.trackIds = trackIds;
    if (isPublic !== undefined) updates.isPublic = isPublic;

    await getDb().collection('playlists').updateOne(
      { playlistId: req.params.playlistId },
      { $set: updates }
    );
    res.json({ message: 'Playlist aktualisiert' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (delete playlist - requires ownership or admin)
router.delete('/:playlistId', authenticate, async (req, res) => {
  try {
    const playlist = await getDb().collection('playlists').findOne({ playlistId: req.params.playlistId });
    if (!playlist) return res.status(404).json({ error: 'Playlist nicht gefunden' });

    const isAdmin = req.user.role === 'admin';
    const isOwner = playlist.createdBy === req.user.userId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Nur der Ersteller oder ein Admin kann diese Playlist löschen' });
    }

    await getDb().collection('playlists').deleteOne({ playlistId: req.params.playlistId });
    res.json({ message: 'Playlist gelöscht' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /stats/genres - Hybrid Aggregation (Playlists + Likes)
router.get('/stats/genres', authenticate, async (req, res) => {
  const session = require('../config/neo4j').getDriver().session();
  try {
    // 1. Get stats from Playlists (MongoDB Aggregation)
    const playlistStats = await getDb().collection('playlists').aggregate([
      { $match: { userId: req.user.userId } },
      { $unwind: '$trackIds' },
      { $lookup: { from: 'tracks', localField: 'trackIds', foreignField: 'trackId', as: 'track' } },
      { $unwind: '$track' },
      { $group: { _id: '$track.genre', count: { $sum: 1 } } }
    ]).toArray();

    // 2. Get Liked Tracks from Neo4j
    const neoResult = await session.run(
      'MATCH (u:User {userId: $userId})-[:LIKES]->(t:Track) RETURN t.trackId AS trackId',
      { userId: req.user.userId }
    );
    const likedTrackIds = neoResult.records.map(r => r.get('trackId'));

    // 3. Get Genres for Liked Tracks (MongoDB Lookup)
    let likedStats = [];
    if (likedTrackIds.length > 0) {
      likedStats = await getDb().collection('tracks').aggregate([
        { $match: { trackId: { $in: likedTrackIds } } },
        { $group: { _id: '$genre', count: { $sum: 1 } } }
      ]).toArray();
    }

    // 4. Merge Results
    const intervalMap = {}; // genre -> count

    // Add Playlist counts
    playlistStats.forEach(s => {
      const g = s._id || 'Unbekannt';
      if (!intervalMap[g]) intervalMap[g] = 0;
      intervalMap[g] += s.count;
    });

    // Add Like counts
    likedStats.forEach(s => {
      const g = s._id || 'Unbekannt';
      if (!intervalMap[g]) intervalMap[g] = 0;
      intervalMap[g] += s.count;
    });

    // Convert back to array and sort
    const finalStats = Object.keys(intervalMap).map(key => ({
      _id: key,
      count: intervalMap[key]
    })).sort((a, b) => b.count - a.count);

    res.json(finalStats);

  } catch (e) {
    console.error('Stats Error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

module.exports = router;
