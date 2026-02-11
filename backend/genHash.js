const bcrypt = require('bcryptjs');
const fs = require('fs');

(async () => {
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('password123', 10);

    const output = `ADMIN_HASH=${adminHash}
USER_HASH=${userHash}`;

    fs.writeFileSync('valid_hashes.txt', output);
    console.log('✅ Hashes written to valid_hashes.txt');
    console.log(output);
})();
