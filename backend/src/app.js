const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectMongo } = require('./config/mongo');
const { connectNeo4j } = require('./config/neo4j');
const { initializeAdmin } = require('./config/initAdmin');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const artistsRouter = require('./routes/artists');
const albumsRouter = require('./routes/albums');
const tracksRouter = require('./routes/tracks');
const playlistsRouter = require('./routes/playlists');
const moodsRouter = require('./routes/moods');
const neo4jRouter = require('./routes/neo4j');
const integrationRouter = require('./routes/integration');


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ── Health-Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/artists', artistsRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/moods', moodsRouter);
app.use('/api/neo4j', neo4jRouter);
app.use('/api/integration', integrationRouter);


// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectMongo();
    connectNeo4j();
    await initializeAdmin(); // Initialize default admin account
    app.listen(PORT, () => console.log(`\n🚀 Server läuft auf http://localhost:${PORT}\n`));
  } catch (err) {
    console.error('❌ Startup-Fehler:', err);
    process.exit(1);
  }
})();


module.exports = app;
