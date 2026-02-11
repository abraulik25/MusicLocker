const jwt = require('jsonwebtoken');

// ── Authenticate Middleware ───────────────────────────────────────────────────
// Verifies JWT token and attaches user to request object
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Kein Token bereitgestellt' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user info to request
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Ungültiger Token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token abgelaufen' });
        }
        return res.status(500).json({ error: error.message });
    }
};

// ── Optional Authenticate Middleware ──────────────────────────────────────────
// Attaches user if token is present, but doesn't require it
const optionalAuthenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
        next();
    } catch (error) {
        // If token is invalid, just continue without user
        next();
    }
};

// ── Require Role Middleware ───────────────────────────────────────────────────
// Checks if authenticated user has one of the required roles
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Nicht authentifiziert' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Zugriff verweigert',
                required: roles,
                current: req.user.role
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    optionalAuthenticate,
    requireRole
};
