const express = require('express');
const router = express.Router();
const { getDb } = require('../config/mongo');
const { authenticate } = require('../middleware/authMiddleware');

// GET all moods
router.get('/', async (req, res) => {
    try {
        const moods = await getDb().collection('moods').find().sort({ name: 1 }).toArray();
        res.json(moods);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET by moodId
router.get('/:moodId', async (req, res) => {
    try {
        const mood = await getDb().collection('moods').findOne({ moodId: req.params.moodId });
        if (!mood) return res.status(404).json({ error: 'Mood nicht gefunden' });
        res.json(mood);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST (create mood - admin only)
router.post('/', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nur Admins können Moods erstellen' });
        }

        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name erforderlich' });

        // Check for duplicate
        const existing = await getDb().collection('moods').findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });
        if (existing) {
            return res.status(400).json({ error: `Mood "${name}" existiert bereits` });
        }

        const moodId = 'mood_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const doc = {
            moodId,
            name,
            description: description || '',
            createdAt: new Date()
        };

        await getDb().collection('moods').insertOne(doc);

        // Sync: Create Mood node in Neo4j
        try {
            const neo4jDriver = require('neo4j-driver');
            const { NEO4J_URI, NEO4J_USER, NEO4J_PASS } = process.env;
            const driver = neo4jDriver.driver(NEO4J_URI, neo4jDriver.auth.basic(NEO4J_USER, NEO4J_PASS));
            const session = driver.session();
            await session.run('MERGE (m:Mood {moodId: $moodId})', { moodId });
            await session.close();
            await driver.close();
        } catch (neo4jErr) {
            console.error('Neo4j mood sync error:', neo4jErr);
        }

        res.status(201).json(doc);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT (update mood - admin only)
router.put('/:moodId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nur Admins können Moods bearbeiten' });
        }

        const { name, description } = req.body;
        const update = {};
        if (name) update.name = name;
        if (description !== undefined) update.description = description;

        const result = await getDb().collection('moods').findOneAndUpdate(
            { moodId: req.params.moodId },
            { $set: update },
            { returnDocument: 'after' }
        );

        if (!result) return res.status(404).json({ error: 'Mood nicht gefunden' });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (admin only) - Cascading delete
router.delete('/:moodId', authenticate, async (req, res) => {
    const neo4jDriver = require('neo4j-driver');
    const { NEO4J_URI, NEO4J_USER, NEO4J_PASS } = process.env;
    const driver = neo4jDriver.driver(NEO4J_URI, neo4jDriver.auth.basic(NEO4J_USER, NEO4J_PASS));
    const session = driver.session();

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nur Admins können Moods löschen' });
        }

        const moodId = req.params.moodId;

        // 1. Get mood name to remove from MongoDB arrays
        const moodToDelete = await getDb().collection('moods').findOne({ moodId });
        if (!moodToDelete) return res.status(404).json({ error: 'Mood nicht gefunden' });

        // 2. Remove from MongoDB 'moods' collection
        await getDb().collection('moods').deleteOne({ moodId });

        // 3. Remove from MongoDB 'tracks.mood' array
        await getDb().collection('tracks').updateMany(
            { mood: moodToDelete.name },
            { $pull: { mood: moodToDelete.name } }
        );

        // 4. Remove from Neo4j (Node + Relationships)
        await session.run(
            'MATCH (m:Mood {moodId: $moodId}) DETACH DELETE m',
            { moodId }
        );

        res.json({ message: 'Mood gelöscht (und aus Tracks entfernt)', moodId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        await session.close();
        await driver.close();
    }
});

module.exports = router;
