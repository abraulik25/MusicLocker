const express = require('express');
const router = express.Router();
const { getDriver } = require('../config/neo4j');
const { MOODS } = require('../constants');

// ── HELPER ────────────────────────────────────────────────────────────────────
function recordToObj(record) {
  const obj = {};
  record.keys.forEach(k => {
    const val = record.get(k);
    obj[k] = val && val.properties ? val.properties : val;
  });
  return obj;
}

// ── USER NODES (only IDs) ────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run('MATCH (u:User) RETURN u');
    res.json(result.records.map(r => r.get('u').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.post('/users', async (req, res) => {
  const session = getDriver().session();
  try {
    const { userId } = req.body;
    const result = await session.run(
      'MERGE (u:User {userId: $userId}) RETURN u',
      { userId }
    );
    res.status(201).json(result.records[0].get('u').properties);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.delete('/users/:userId', async (req, res) => {
  const session = getDriver().session();
  try {
    await session.run('MATCH (u:User {userId: $id}) DETACH DELETE u', { id: req.params.userId });
    res.json({ message: 'User aus Neo4j gelöscht' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// ── ARTIST NODES (only IDs) ──────────────────────────────────────────────────
router.get('/artists', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run('MATCH (a:Artist) RETURN a');
    res.json(result.records.map(r => r.get('a').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.post('/artists', async (req, res) => {
  const session = getDriver().session();
  try {
    const { artistId } = req.body;
    const result = await session.run(
      'MERGE (a:Artist {artistId: $artistId}) RETURN a',
      { artistId }
    );
    res.status(201).json(result.records[0].get('a').properties);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.delete('/artists/:artistId', async (req, res) => {
  const session = getDriver().session();
  try {
    await session.run('MATCH (a:Artist {artistId: $id}) DETACH DELETE a', { id: req.params.artistId });
    res.json({ message: 'Artist aus Neo4j gelöscht' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// ── MOOD NODES ────────────────────────────────────────────────────────────────
router.get('/moods', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run('MATCH (m:Mood) RETURN m ORDER BY m.moodId');
    res.json(result.records.map(r => r.get('m').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.post('/moods/init', async (req, res) => {
  const session = getDriver().session();
  try {
    const { getDb } = require('../config/mongo');
    const moods = await getDb().collection('moods').find().toArray();

    // Create mood nodes with only moodId
    for (const mood of moods) {
      await session.run('MERGE (m:Mood {moodId: $moodId})', { moodId: mood.moodId });
    }
    res.status(201).json({ message: `${moods.length} Mood-Nodes erstellt`, count: moods.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// ── TRACK NODES (only IDs) ───────────────────────────────────────────────────
router.get('/tracks', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run('MATCH (t:Track) RETURN t');
    res.json(result.records.map(r => r.get('t').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.post('/tracks', async (req, res) => {
  const session = getDriver().session();
  try {
    const { trackId, artistId, moodIds } = req.body;
    const moodArray = Array.isArray(moodIds) ? moodIds : (moodIds ? [moodIds] : []);

    // Create track node
    await session.run('MERGE (t:Track {trackId: $trackId})', { trackId });

    // Create PERFORMED_BY relationship
    await session.run(
      `MATCH (t:Track {trackId: $trackId})
       MATCH (a:Artist {artistId: $artistId})
       MERGE (t)-[:PERFORMED_BY]->(a)`,
      { trackId, artistId }
    );

    // Create HAS_MOOD relationships using moodId
    for (const moodId of moodArray) {
      await session.run(
        `MATCH (t:Track {trackId: $trackId})
         MATCH (m:Mood {moodId: $moodId})
         MERGE (t)-[:HAS_MOOD]->(m)`,
        { trackId, moodId }
      );
    }

    res.status(201).json({ trackId, message: 'Track und Mood-Beziehungen erstellt' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.delete('/tracks/:trackId', async (req, res) => {
  const session = getDriver().session();
  try {
    await session.run('MATCH (t:Track {trackId: $id}) DETACH DELETE t', { id: req.params.trackId });
    res.json({ message: 'Track aus Neo4j gelöscht' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// ── ALBUM NODES (only IDs) ──────────────────────────────────────────────────
router.get('/albums', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run('MATCH (a:Album) RETURN a');
    res.json(result.records.map(r => r.get('a').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.post('/albums', async (req, res) => {
  const session = getDriver().session();
  try {
    const { albumId } = req.body;
    const result = await session.run(
      'MERGE (a:Album {albumId: $albumId}) RETURN a',
      { albumId }
    );
    res.status(201).json(result.records[0].get('a').properties);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

router.delete('/albums/:albumId', async (req, res) => {
  const session = getDriver().session();
  try {
    await session.run('MATCH (a:Album {albumId: $id}) DETACH DELETE a', { id: req.params.albumId });
    res.json({ message: 'Album aus Neo4j gelöscht' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// ── RELATIONSHIPS ────────────────────────────────────────────────────────────
// LIKES hinzufügen (Tracks)
router.post('/likes', async (req, res) => {
  const session = getDriver().session();
  try {
    const { userId, trackId } = req.body;
    await session.run(
      'MATCH (u:User {userId: $userId}), (t:Track {trackId: $trackId}) MERGE (u)-[:LIKES]->(t)',
      { userId, trackId }
    );
    res.status(201).json({ message: 'LIKES-Beziehung erstellt', userId, trackId });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// LIKES entfernen (Tracks)
router.delete('/likes/:userId/:trackId', async (req, res) => {
  const session = getDriver().session();
  try {
    await session.run(
      'MATCH (u:User {userId: $userId})-[r:LIKES]->(t:Track {trackId: $trackId}) DELETE r',
      { userId: req.params.userId, trackId: req.params.trackId }
    );
    res.json({ message: 'LIKES-Beziehung entfernt' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// LIKES hinzufügen (Albums)
router.post('/likes/album', async (req, res) => {
  const session = getDriver().session();
  try {
    const { userId, albumId } = req.body;
    // Ensure Album exists before liking (lazy create if needed, or just Match)
    // Here we MERGE the Album node to ensure it exists
    await session.run(
      `MERGE (a:Album {albumId: $albumId})
       WITH a
       MATCH (u:User {userId: $userId})
       MERGE (u)-[:LIKES]->(a)`,
      { userId, albumId }
    );
    res.status(201).json({ message: 'Album liked', userId, albumId });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// LIKES entfernen (Albums) — löscht Album-Node wenn keine LIKES mehr vorhanden
router.delete('/likes/album/:userId/:albumId', async (req, res) => {
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (u:User {userId: $userId})-[r:LIKES]->(a:Album {albumId: $albumId})
       DELETE r
       WITH a
       WHERE NOT EXISTS { ()-[:LIKES]->(a) }
       DELETE a`,
      { userId: req.params.userId, albumId: req.params.albumId }
    );
    res.json({ message: 'Album unliked' });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// ── CYPHER-ABFRAGEN (return only IDs) ────────────────────────────────────────

// 1) Alle Tracks eines Artists im Graph (nur IDs)
router.get('/query/artist-tracks/:artistId', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run(
      'MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {artistId: $id}) RETURN t.trackId AS trackId',
      { id: req.params.artistId }
    );
    res.json(result.records.map(r => r.get('trackId')));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// 2) Tracks mit bestimmtem Mood (by moodId)
router.get('/query/mood-tracks/:moodId', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run(
      'MATCH (t:Track)-[:HAS_MOOD]->(m:Mood {moodId: $moodId}) RETURN t.trackId AS trackId',
      { moodId: req.params.moodId }
    );
    res.json(result.records.map(r => r.get('trackId')));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// 3) Was einem User gefällt (LIKES) - nur IDs
router.get('/query/user-likes/:userId', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run(
      'MATCH (u:User {userId: $id})-[:LIKES]->(t:Track) RETURN t.trackId AS trackId',
      { id: req.params.userId }
    );
    res.json(result.records.map(r => r.get('trackId')));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// 3b) Was einem User gefällt (ALBUM LIKES) - nur IDs
router.get('/query/user-liked-albums/:userId', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run(
      'MATCH (u:User {userId: $id})-[:LIKES]->(a:Album) RETURN a.albumId AS albumId',
      { id: req.params.userId }
    );
    res.json(result.records.map(r => r.get('albumId')));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

// 4) Alle gelikten Tracks (von allen Usern)
router.get('/query/all-likes', async (req, res) => {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (u:User)-[:LIKES]->(t:Track)
       RETURN DISTINCT t.trackId AS trackId, COUNT(u) AS likeCount
       ORDER BY likeCount DESC`
    );
    res.json(result.records.map(r => ({
      trackId: r.get('trackId'),
      likeCount: r.get('likeCount').toInt()
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await session.close(); }
});

module.exports = router;
