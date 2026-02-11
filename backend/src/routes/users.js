const express = require('express');
const router = express.Router();
const { getDb } = require('../config/mongo');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// ── GET /api/users ────────────────────────────────────────────────────────────
// Get all users (requires authentication)
router.get('/', authenticate, async (req, res) => {
  try {
    const users = await getDb().collection('users').find().toArray();

    // Remove passwords from all users
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json(usersWithoutPasswords);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/users/:userId ────────────────────────────────────────────────────
// Get single user (users can view their own profile, admins can view any)
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is viewing their own profile or is admin
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const user = await getDb().collection('users').findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/users/:userId ────────────────────────────────────────────────────
// Update user (users can only edit their own name, admins can edit everything)
router.put('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.userId === userId;

    // Users can only edit their own profile
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sie können nur Ihr eigenes Profil bearbeiten' });
    }

    // Regular users can only edit their name
    let updateData = {};
    if (isAdmin) {
      // Admins can update everything except password
      const { password, ...allowedUpdates } = req.body;
      updateData = allowedUpdates;
    } else {
      // Regular users can only update their name
      if (req.body.name) {
        updateData.name = req.body.name;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Felder zum Aktualisieren' });
    }

    const result = await getDb().collection('users').findOneAndUpdate(
      { userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }

    const { password, ...userWithoutPassword } = result;
    res.json(userWithoutPassword);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/users/:userId ─────────────────────────────────────────────────
// Delete user (users can delete their own account, admins can delete any)
router.delete('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const isAdmin = req.user.role === 'admin';
    const isOwner = req.user.userId === userId;

    // Users can only delete their own account
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sie können nur Ihr eigenes Konto löschen' });
    }

    const result = await getDb().collection('users').deleteOne({ userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }

    // Also delete from Neo4j
    const { getDriver } = require('../config/neo4j');
    const session = getDriver().session();
    try {
      await session.run('MATCH (u:User {userId: $id}) DETACH DELETE u', { id: userId });
      console.log(`Deleted user ${userId} from Neo4j`);
    } catch (err) {
      console.error('Failed to delete user from Neo4j:', err);
      // We don't fail the request if Neo4j deletion fails, but we log it
    } finally {
      await session.close();
    }

    res.json({ message: 'User erfolgreich gelöscht', userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/users/:userId/follow ──────────────────────────────────
// Follow a user
router.post('/:userId/follow', authenticate, async (req, res) => {
  const { getDriver } = require('../config/neo4j');
  const session = getDriver().session();
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Du kannst dir nicht selbst folgen' });
    }

    // Check if target user exists
    const targetUser = await getDb().collection('users').findOne({ userId: targetUserId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Add to following array (using $addToSet to avoid duplicates)
    await getDb().collection('users').updateOne(
      { userId: currentUserId },
      { $addToSet: { following: targetUserId } }
    );

    // Sync to Neo4j
    await session.run(`
      MATCH (u1:User {userId: $currentUserId})
      MATCH (u2:User {userId: $targetUserId})
      MERGE (u1)-[:FOLLOWS]->(u2)
    `, { currentUserId, targetUserId });

    res.json({ message: 'Erfolgreich gefolgt', userId: targetUserId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

// ── DELETE /api/users/:userId/follow ────────────────────────────────
// Unfollow a user
router.delete('/:userId/follow', authenticate, async (req, res) => {
  const { getDriver } = require('../config/neo4j');
  const session = getDriver().session();
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

    // Remove from following array
    await getDb().collection('users').updateOne(
      { userId: currentUserId },
      { $pull: { following: targetUserId } }
    );

    // Sync to Neo4j
    await session.run(`
      MATCH (u1:User {userId: $currentUserId})-[r:FOLLOWS]->(u2:User {userId: $targetUserId})
      DELETE r
    `, { currentUserId, targetUserId });

    res.json({ message: 'Nicht mehr gefolgt', userId: targetUserId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

module.exports = router;
