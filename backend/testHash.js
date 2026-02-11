const bcrypt = require('bcryptjs');

// Test password verification
(async () => {
    const testPassword = 'admin123';
    const testHash = '$2b$10$yDFTRJcjHa5mo7yQ3678evbPasy/no6';

    console.log('Testing password:', testPassword);
    console.log('Against hash:', testHash);

    const result = await bcrypt.compare(testPassword, testHash);
    console.log('Match result:', result);

    if (!result) {
        console.log('\n❌ Hash is INVALID! Generating new one...');
        const newHash = await bcrypt.hash(testPassword, 10);
        console.log('New valid hash for admin123:', newHash);

        const userHash = await bcrypt.hash('password123', 10);
        console.log('New valid hash for password123:', userHash);
    } else {
        console.log('\n✅ Hash is valid!');
    }
})();
