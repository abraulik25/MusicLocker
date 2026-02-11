const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/mongo');
const { authenticate, requireRole, optionalAuthenticate } = require('../middleware/authMiddleware');


// ── Helper: Generate JWT Token ────────────────────────────────────────────────
function generateToken(user) {
    return jwt.sign(
        { userId: user.userId, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Public endpoint with optional authentication for admin user creation
router.post('/register', optionalAuthenticate, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, Email und Passwort erforderlich' });
        }

        // Validate name length
        if (name.length < 2) {
            return res.status(400).json({ error: 'Name muss mindestens 2 Zeichen lang sein' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ungültiges Email-Format' });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
        }

        // Check if user already exists
        const existingUser = await getDb().collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email bereits registriert' });
        }

        // Validate preferredMoods for public registration (not for admin-created users)
        if (!req.user && req.body.preferredMoods) {
            const { MOODS } = require('../constants');
            if (!Array.isArray(req.body.preferredMoods) || req.body.preferredMoods.length !== 3) {
                return res.status(400).json({ error: 'Bitte wähle genau 3 bevorzugte Moods' });
            }
            const invalidMoods = req.body.preferredMoods.filter(m => !MOODS.includes(m));
            if (invalidMoods.length > 0) {
                return res.status(400).json({ error: `Ungültige Moods: ${invalidMoods.join(', ')}` });
            }
        }

        // Determine role: public registrations are always 'user', only authenticated admins can create admin users
        let userRole = 'user';
        if (role && (role === 'admin' || role === 'moderator')) {
            // Check if request is from an authenticated admin
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Nur Admins können Admin- oder Moderator-Accounts erstellen' });
            }
            userRole = role;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userId = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const newUser = {
            userId,
            name,
            email,
            password: hashedPassword,
            role: userRole,
            isActive: true,
            favoriteGenres: [],
            preferredMoods: req.body.preferredMoods || [],
            createdAt: new Date()
        };

        await getDb().collection('users').insertOne(newUser);

        // Sync with Neo4j
        try {
            const { connectNeo4j } = require('../config/neo4j');
            const driver = connectNeo4j();
            const session = driver.session();
            await session.run(
                'MERGE (u:User {userId: $userId}) SET u.name = $name',
                { userId, name }
            );
            await session.close();
            console.log(`[Auth] User ${userId} synced to Neo4j`);
        } catch (neoErr) {
            console.error('[Auth] Failed to sync user to Neo4j:', neoErr);
            // We do not fail the request, but log the error
        }

        // Generate token
        const token = generateToken(newUser);

        // Return user without password
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({ user: userWithoutPassword, token });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email und Passwort erforderlich' });
        }

        // Find user
        const user = await getDb().collection('users').findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account ist deaktiviert' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        // Generate token
        const token = generateToken(user);

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Nicht authentifiziert' });
        }

        const user = await getDb().collection('users').findOne({ userId: req.user.userId });
        if (!user) {
            return res.status(404).json({ error: 'User nicht gefunden' });
        }

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put('/change-password', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Nicht authentifiziert' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
        }

        // Find user
        const user = await getDb().collection('users').findOne({ userId: req.user.userId });
        if (!user) {
            return res.status(404).json({ error: 'User nicht gefunden' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await getDb().collection('users').updateOne(
            { userId: req.user.userId },
            { $set: { password: hashedPassword } }
        );

        res.json({ message: 'Passwort erfolgreich geändert' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/auth/users (Admin only) ──────────────────────────────────────────
router.get('/users', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const users = await getDb().collection('users').find().toArray();

        // Remove passwords from all users
        const usersWithoutPasswords = users.map(user => {
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json(usersWithoutPasswords);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── PUT /api/auth/users/:userId/role (Admin only) ─────────────────────────────
router.put('/users/:userId/role', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['user', 'admin', 'moderator'];

        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Ungültige Rolle. Erlaubt: user, admin, moderator' });
        }

        const result = await getDb().collection('users').findOneAndUpdate(
            { userId: req.params.userId },
            { $set: { role } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'User nicht gefunden' });
        }

        const { password: _, ...userWithoutPassword } = result;
        res.json(userWithoutPassword);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── DELETE /api/auth/users/:userId (Admin only) ───────────────────────────────
router.delete('/users/:userId', authenticate, requireRole('admin'), async (req, res) => {
    try {
        // Prevent deleting yourself
        if (req.user.userId === req.params.userId) {
            return res.status(400).json({ error: 'Sie können Ihren eigenen Account nicht löschen' });
        }

        const result = await getDb().collection('users').deleteOne({ userId: req.params.userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User nicht gefunden' });
        }

        res.json({ message: 'User erfolgreich gelöscht', userId: req.params.userId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
