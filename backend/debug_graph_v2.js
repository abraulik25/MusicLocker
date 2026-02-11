const neo4j = require('neo4j-driver');
require('dotenv').config();

async function run() {
    const driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASS)
    );
    const session = driver.session();

    try {
        console.log('🔍 Checking for ANY DIRECT User-Artist relationships...');

        // Check User -> Artist
        const r1 = await session.run(`
            MATCH (u:User)-[r]->(a:Artist)
            RETURN u.name AS userName, type(r) AS relType, a.name AS artistName
        `);
        if (r1.records.length === 0) {
            console.log('✅ No direct User -> Artist relationships found.');
        } else {
            r1.records.forEach(rec => {
                console.log(`FOUND: ${rec.get('userName')} --[${rec.get('relType')}]--> ${rec.get('artistName')}`);
            });
        }

        // Check Artist -> User (just in case)
        const r2 = await session.run(`
            MATCH (a:Artist)-[r]->(u:User)
            RETURN a.name AS artistName, type(r) AS relType, u.name AS userName
        `);
        if (r2.records.length === 0) {
            console.log('✅ No direct Artist -> User relationships found.');
        } else {
            r2.records.forEach(rec => {
                console.log(`FOUND: ${rec.get('artistName')} --[${rec.get('relType')}]--> ${rec.get('userName')}`);
            });
        }

        // Check indirect relationship via Track
        console.log('\n🔍 Checking indirect relationship User -> Track -> Artist (via LIKES & PERFORMED_BY)...');
        const r3 = await session.run(`
            MATCH (u:User {name: 'Ben Mueller'})-[:LIKES]->(t:Track)-[:PERFORMED_BY]->(a:Artist)
            RETURN u.name AS userName, t.title AS trackTitle, a.name AS artistName
        `);
        if (r3.records.length === 0) {
            console.log('Ben hasn\'t liked any tracks.');
        } else {
            r3.records.forEach(rec => {
                console.log(`INDIRECT: ${rec.get('userName')} LIKES track "${rec.get('trackTitle')}" by ${rec.get('artistName')}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}

run();
