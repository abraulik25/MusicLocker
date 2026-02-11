const neo4j = require('neo4j-driver');
require('dotenv').config();

let driver;

function connectNeo4j() {
  try {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASS)
    );
    console.log('✅ Neo4j Driver erstellt:', process.env.NEO4J_URI);
    return driver;
  } catch (err) {
    console.error('❌ Neo4j Verbindungsfehler:', err.message);
    throw err;
  }
}

function getDriver() {
  if (!driver) throw new Error('Neo4j nicht verbunden');
  return driver;
}

module.exports = { connectNeo4j, getDriver };
