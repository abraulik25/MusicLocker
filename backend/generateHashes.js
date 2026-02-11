const bcrypt = require('bcryptjs');
const fs = require('fs');

(async () => {
    // Generate hashes
    const userHash = await bcrypt.hash('password123', 10);
    const adminHash = await bcrypt.hash('admin123', 10);

    console.log('Generated valid password hashes:');
    console.log('');
    console.log('// Users (password: password123)');
    console.log(`const USER_HASH = '${userHash}';`);
    console.log('');
    console.log('// Admin (password: admin123)');
    console.log(`const ADMIN_HASH = '${adminHash}';`);
    console.log('');
    console.log('Copy these into seedData.js!');

    // Write to file
    const content = `// Generated password hashes - ${new Date().toISOString()}

// Users (password: password123)
const USER_HASH = '${userHash}';

// Admin (password: admin123)
const ADMIN_HASH = '${adminHash}';

// Use these in your seedData.js file
`;

    fs.writeFileSync('HASHES.txt', content);
    console.log('\n✅ Hashes saved to HASHES.txt');
})();
