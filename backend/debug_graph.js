const neo4j = require('neo4j-driver');
require('dotenv').config();

async function run() {
    const driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASS)
    );
    const session = driver.session();

    try {
        console.log('🔍 Checking Ben Mueller (user_002)...');
        const r1 = await session.run(`
            MATCH (u:User {name: 'Ben Mueller'})-[r]->(n)
            RETURN type(r) AS relType, labels(n) AS targetLabels, n.name AS targetName, n.title AS targetTitle
        `);
        r1.records.forEach(rec => {
            console.log(`Ben --[${rec.get('relType')}]--> (${rec.get('targetLabels')}) ${rec.get('targetName') || rec.get('targetTitle')}`);
        });

        console.log('\n🔍 Checking David Fischer (user_004)...');
        const r2 = await session.run(`
            MATCH (u:User {name: 'David Fischer'})-[r]->(n)
            RETURN type(r) AS relType, labels(n) AS targetLabels, n.name AS targetName, n.title AS targetTitle
        `);
        r2.records.forEach(rec => {
            console.log(`David --[${rec.get('relType')}]--> (${rec.get('targetLabels')}) ${rec.get('targetName') || rec.get('targetTitle')}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}

run();
