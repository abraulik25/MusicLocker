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

// DELETE (admin only)
router.delete('/:moodId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nur Admins können Moods löschen' });
        }

        const result = await getDb().collection('moods').deleteOne({ moodId: req.params.moodId });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Mood nicht gefunden' });
        res.json({ message: 'Mood gelöscht', moodId: req.params.moodId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
