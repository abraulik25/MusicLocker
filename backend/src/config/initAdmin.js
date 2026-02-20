const bcrypt = require('bcryptjs');
const { getDb } = require('./mongo');

// ── Initialize Default Admin Account ──────────────────────────────────────────
async function initializeAdmin() {
    try {
        const adminEmail = 'admin@musiclocker.com';

        // Check if admin already exists
        const existingAdmin = await getDb().collection('users').findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('✓ Admin account already exists');
            return;
        }

        // Create default admin account
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const adminUser = {
            userId: 'user_admin_' + Date.now().toString(36),
            name: 'Administrator',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            isActive: true,
            favoriteGenres: [],
            createdAt: new Date()
        };

        await getDb().collection('users').insertOne(adminUser);
        console.log('✓ Default admin account created');
        console.log('  Email: admin@melodygraph.com');
        console.log('  Password: admin123');
        console.log('  ⚠️  Please change the password after first login!');
    } catch (error) {
        console.error('❌ Error initializing admin account:', error.message);
    }
}

module.exports = { initializeAdmin };
