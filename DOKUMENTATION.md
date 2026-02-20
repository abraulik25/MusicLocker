# MelodyGraph – Programmdokumentation

## 1. Überblick

**MelodyGraph** ist eine Musikempfehlungs-Webanwendung, die zwei Datenbanksysteme kombiniert: **MongoDB** (Dokumentendatenbank) und **Neo4j** (Graphdatenbank).

### Anwendungsszenario
Nutzer können sich registrieren, Musik durchsuchen (Künstler, Alben, Tracks), Songs liken, Playlisten erstellen und personalisierte Empfehlungen erhalten. Das Empfehlungssystem basiert auf **Stimmungen (Moods)**: Wenn ein Nutzer Songs mit bestimmten Moods liked, werden ihm ähnliche Songs mit überlappenden Moods vorgeschlagen.

### Kernfunktionen
- **Benutzerverwaltung**: Registrierung, Login (JWT), Rollensystem (Admin/User)
- **Musikverwaltung**: CRUD für Künstler, Alben, Tracks mit Mood-Tags
- **Soziale Features**: Nutzer folgen, öffentliche Playlisten teilen
- **Likes & Empfehlungen**: Mood-basiertes Empfehlungssystem über Neo4j-Graph
- **Dashboard**: Echtzeit-Genre-Statistik, beliebte Tracks, personalisierte Empfehlungen

---

## 2. Installation

### Voraussetzungen
- **Docker Desktop** (oder Docker Engine + Docker Compose) für MongoDB und Neo4j
- **Node.js** (v18+) und **npm** (für Backend und Frontend)
- **Git** (zum Klonen des Repositories)

### Setup

#### Schritt 1: Repository klonen
```bash
git clone <repository-url>
cd MelodyGraph_Musikempfehlung
```

#### Schritt 2: Datenbanken mit Docker starten

Im Projektordner liegt eine `docker-compose.yml`, die MongoDB und Neo4j konfiguriert:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7.0
    container_name: musik_mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=musikempfehlung

  neo4j:
    image: neo4j:5.24
    container_name: musik_neo4j
    ports:
      - "7474:7474"   # Browser-UI
      - "7687:7687"   # Bolt-Protokoll
    environment:
      - NEO4J_AUTH=neo4j/neo4jpassword
    volumes:
      - neo4j_data:/data

volumes:
  mongo_data:
  neo4j_data:
```

Container starten:
```bash
docker-compose up -d
```

Prüfen, ob die Container laufen:
```bash
docker ps
```
→ MongoDB läuft auf `localhost:27017`, Neo4j auf `localhost:7687` (Graph-Browser: `http://localhost:7474`)

#### Schritt 3: Umgebungsvariablen prüfen

Im Ordner `backend` liegt bereits die fertige `.env`-Datei für das Uni-Projekt. Diese wurde für die einfache Ausführung absichtlich mit ins Repository gepackt.

Sie enthält folgende Konfiguration:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/musikempfehlung
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASS=neo4jpassword
JWT_SECRET=super_secret_key_123
JWT_EXPIRES_IN=24h
```

#### Schritt 4: Backend und Frontend starten

Starten Sie beide Server manuell in zwei separaten Terminal-Fenstern. Installieren Sie zuerst die Abhängigkeiten:

**Terminal 1 (Backend):**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm start
```

#### Schritt 5: Datenbank mit Testdaten befüllen (einmalig)
```bash
node src/seed.js
```
Dieser Befehl erstellt Testdaten in MongoDB (Users, Artists, Albums, Tracks, Moods) und die zugehörigen Nodes/Beziehungen in Neo4j.

### Erreichbarkeit

| Dienst | URL |
|--------|-----|
| Frontend (React) | `http://localhost:3000` |
| Backend (API) | `http://localhost:5000` |
| Neo4j Browser | `http://localhost:7474` |

### Standard-Login

| Rolle | E-Mail | Passwort |
|-------|--------|----------|
| Admin | `admin@musiclocker.com` | `admin123` |
| User | `anna@example.com` | `password123` |

### Docker-Container stoppen
```bash
docker-compose down        # Container stoppen (Daten bleiben erhalten)
docker-compose down -v     # Container + Daten komplett löschen
```

---

## 3. Architektur

### 3.1 Gesamtarchitektur

Die Anwendung folgt einer klassischen **3-Schichten-Architektur**:

```
┌─────────────────────────────────────────────┐
│              Frontend (React)               │
│         http://localhost:3000               │
│  Pages: Dashboard, Tracks, Artists,         │
│  Albums, Playlists, Moods, Users, Neo4jView │
└──────────────────┬──────────────────────────┘
                   │ REST API (JSON)
┌──────────────────▼──────────────────────────┐
│         Backend (Express.js)                │
│         http://localhost:5000               │
│   Routes: /api/users, /api/tracks,          │
│   /api/neo4j, /api/integration, ...         │
│   Auth: JWT Middleware                      │
└────────┬──────────────────┬─────────────────┘
         │                  │
┌────────▼────────┐  ┌──────▼──────────┐
│    MongoDB      │  │     Neo4j       │
│  Port 27017     │  │   Port 7687     │
│  (Dokumente)    │  │  (Graph)        │
└─────────────────┘  └─────────────────┘
```

### 3.2 Zusammenspiel Frontend – Backend – Datenbanken

1. **Frontend → Backend**: React-Komponenten rufen REST-Endpunkte auf (`/api/...`). Authentifizierung erfolgt über JWT-Tokens im `Authorization`-Header.
2. **Backend → MongoDB**: Alle CRUD-Operationen für Stammdaten (Users, Artists, Albums, Tracks, Playlists, Moods).
3. **Backend → Neo4j**: Beziehungen und Graph-Traversierungen (Likes, Follows, Mood-Verknüpfungen, Empfehlungen).
4. **Integration**: Der `/api/integration/recommendations`-Endpunkt kombiniert beide Datenbanken – Neo4j liefert Empfehlungs-IDs per Graph-Traversierung, MongoDB liefert die vollständigen Track-Details.

### 3.3 Begründung der Datenbank-Aufteilung

| Daten | Datenbank | Begründung |
|-------|-----------|------------|
| Users, Artists, Albums, Tracks, Playlists, Moods | **MongoDB** | Komplexe Dokumente mit vielen Attributen (Name, E-Mail, Genre, Dauer, Beschreibung etc.) – ideal für dokumentenbasierte Speicherung |
| LIKES, FOLLOWS, PERFORMED_BY, HAS_MOOD | **Neo4j** | Beziehungen zwischen Entitäten – Graph-Traversierungen sind performanter als JOINs für Empfehlungs-Algorithmen |
| Empfehlungen | **Beide** | Neo4j traversiert den Graph (z.B. „Finde Tracks mit gleichen Moods"), MongoDB liefert die Detail-Informationen |

**Kerngedanke**: MongoDB speichert die **Stammdaten** (Was ist ein Track?), Neo4j speichert die **Beziehungen** (Wer liked was? Welcher Track hat welchen Mood?).

---

## 4. Datenmodelle

### 4.1 MongoDB – Collections

#### Collection: `users`
```json
{
  "userId": "user_001",
  "name": "Anna Schmidt",
  "email": "anna@example.com",
  "password": "$2b$10$...",
  "role": "user",
  "isActive": true,
  "favoriteGenres": ["Rock", "Pop"],
  "preferredMoods": ["Happy", "Energetic"],
  "following": ["user_002", "user_003"],
  "createdAt": "2026-01-15T12:00:00Z"
}
```

#### Collection: `artists`
```json
{
  "artistId": "art_001",
  "name": "Michael Jackson",
  "genre": "Pop",
  "bio": "King of Pop",
  "origin": "Gary, Indiana, USA",
  "formedYear": 1964,
  "createdBy": "user_001",
  "createdAt": "2026-01-15T12:00:00Z"
}
```

#### Collection: `albums`
```json
{
  "albumId": "alb_001",
  "artistId": "art_001",
  "title": "Thriller",
  "releaseYear": 1982,
  "genre": "Pop",
  "trackCount": 9,
  "duration_min": 42,
  "createdBy": "user_001",
  "createdAt": "2026-01-15T12:00:00Z"
}
```

#### Collection: `tracks`
```json
{
  "trackId": "trk_001",
  "albumId": "alb_001",
  "artistId": "art_001",
  "title": "Billie Jean",
  "duration_sec": 294,
  "genre": "Pop",
  "mood": ["Energetic", "Mysterious", "Dark"],
  "createdBy": "user_001",
  "createdAt": "2026-01-15T12:00:00Z"
}
```

#### Collection: `playlists`
```json
{
  "playlistId": "pl_001",
  "userId": "user_001",
  "name": "80s Classics",
  "description": "Die besten Songs der 80er",
  "trackIds": ["trk_001", "trk_002", "trk_004"],
  "isPublic": true,
  "createdBy": "user_001",
  "createdAt": "2026-01-15T12:00:00Z"
}
```

#### Collection: `moods`
```json
{
  "moodId": "mood_001",
  "name": "Happy",
  "description": "Fröhliche, aufmunternde Musik",
  "keywords": ["joy", "cheerful", "bright"],
  "createdAt": "2026-01-15T12:00:00Z"
}
```

### 4.2 Neo4j – Node-Labels und Relationship-Typen

#### Node-Labels

| Label | Eigenschaften | Beschreibung |
|-------|--------------|--------------|
| `User` | `userId` | Repräsentiert einen Benutzer |
| `Artist` | `artistId` | Repräsentiert einen Künstler |
| `Track` | `trackId` | Repräsentiert einen Song |
| `Album` | `albumId` | Repräsentiert ein Album |
| `Mood` | `moodId` | Repräsentiert eine Stimmung |

#### Relationship-Typen

| Beziehung | Von → Nach | Beschreibung |
|-----------|------------|--------------|
| `LIKES` | User → Track | Nutzer hat einen Song geliked |
| `LIKES` | User → Album | Nutzer hat ein Album geliked |
| `FOLLOWS` | User → User | Nutzer folgt einem anderen Nutzer |
| `PERFORMED_BY` | Track → Artist | Song wurde von Künstler aufgeführt |
| `HAS_MOOD` | Track → Mood | Song hat diese Stimmung |

#### Beispielgraph

```
(Anna:User)──LIKES──>(Billie Jean:Track)──PERFORMED_BY──>(Michael Jackson:Artist)
                              │
                          HAS_MOOD
                              │
                              ▼
                        (Energetic:Mood)<──HAS_MOOD──(One More Time:Track)
                              │
                          HAS_MOOD (von One More Time)
                              │
                        (Happy:Mood)

(Anna:User)──FOLLOWS──>(Ben:User)──LIKES──>(Thriller:Track)
```

In diesem Beispiel würde das Empfehlungssystem Anna den Track „One More Time" empfehlen, weil er den Mood „Energetic" mit „Billie Jean" teilt.

---

## 5. Datenbankoperationen

### 5.1 MongoDB – CRUD-Befehle

#### Create (Einfügen)
```javascript
// Neuen Track erstellen
await db.collection('tracks').insertOne({
  trackId: 'trk_xyz',
  title: 'Neuer Song',
  artistId: 'art_001',
  genre: 'Pop',
  mood: ['Happy', 'Energetic'],
  createdBy: 'user_001',
  createdAt: new Date()
});
```

#### Read (Lesen)
```javascript
// Alle Tracks eines Genres filtern
await db.collection('tracks').find({ genre: 'Pop' }).toArray();

// Einen bestimmten Track finden
await db.collection('tracks').findOne({ trackId: 'trk_001' });

// Mehrere Tracks per ID-Array holen
await db.collection('tracks').find({ trackId: { $in: ['trk_001', 'trk_002'] } }).toArray();
```

#### Update (Aktualisieren)
```javascript
// Track-Titel ändern
await db.collection('tracks').findOneAndUpdate(
  { trackId: 'trk_001' },
  { $set: { title: 'Neuer Titel' } },
  { returnDocument: 'after' }
);

// Nutzer folgen (ohne Duplikate mit $addToSet)
await db.collection('users').updateOne(
  { userId: 'user_001' },
  { $addToSet: { following: 'user_002' } }
);
```

#### Delete (Löschen)
```javascript
// Track löschen
await db.collection('tracks').deleteOne({ trackId: 'trk_001' });
```

### 5.2 MongoDB – Aggregation-Pipeline

Die Genre-Statistik nutzt eine **Aggregation-Pipeline**, die Playlist-Tracks auflöst und nach Genre gruppiert:

```javascript
// Genre-Statistik aus Playlisten eines Users
await db.collection('playlists').aggregate([
  // 1. Nur Playlisten des aktuellen Users
  { $match: { userId: 'user_001' } },
  // 2. trackIds-Array auflösen (ein Dokument pro Track-ID)
  { $unwind: '$trackIds' },
  // 3. Track-Details aus der tracks-Collection nachladen (ähnlich wie JOIN)
  { $lookup: {
      from: 'tracks',
      localField: 'trackIds',
      foreignField: 'trackId',
      as: 'track'
  }},
  // 4. Lookup-Array auflösen
  { $unwind: '$track' },
  // 5. Nach Genre gruppieren und zählen
  { $group: { _id: '$track.genre', count: { $sum: 1 } } }
]).toArray();
```

**Ergebnis-Beispiel:**
```json
[
  { "_id": "Pop", "count": 5 },
  { "_id": "Rock", "count": 3 },
  { "_id": "Hip-Hop", "count": 2 }
]
```

### 5.3 Neo4j – CRUD-Befehle (Cypher)

#### Create (Nodes und Beziehungen)
```cypher
-- Neuen User-Node erstellen (MERGE verhindert Duplikate)
MERGE (u:User {userId: 'user_001'})

-- LIKES-Beziehung erstellen
MATCH (u:User {userId: 'user_001'}), (t:Track {trackId: 'trk_001'})
MERGE (u)-[:LIKES]->(t)

-- Track mit Artist-Beziehung erstellen
MATCH (t:Track {trackId: 'trk_001'})
MATCH (a:Artist {artistId: 'art_001'})
MERGE (t)-[:PERFORMED_BY]->(a)

-- Mood-Beziehung erstellen
MATCH (t:Track {trackId: 'trk_001'})
MATCH (m:Mood {moodId: 'mood_003'})
MERGE (t)-[:HAS_MOOD]->(m)

-- FOLLOWS-Beziehung erstellen
MATCH (u1:User {userId: 'user_001'})
MATCH (u2:User {userId: 'user_002'})
MERGE (u1)-[:FOLLOWS]->(u2)
```

#### Read (Graph-Abfragen)
```cypher
-- Alle Tracks eines Künstlers
MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {artistId: 'art_001'})
RETURN t.trackId AS trackId

-- Alle gelikten Tracks eines Users
MATCH (u:User {userId: 'user_001'})-[:LIKES]->(t:Track)
RETURN t.trackId AS trackId

-- Beliebteste Tracks (nach Anzahl Likes sortiert)
MATCH (u:User)-[:LIKES]->(t:Track)
RETURN DISTINCT t.trackId AS trackId, COUNT(u) AS likeCount
ORDER BY likeCount DESC

-- Tracks mit einem bestimmten Mood
MATCH (t:Track)-[:HAS_MOOD]->(m:Mood {moodId: 'mood_003'})
RETURN t.trackId AS trackId
```

#### Delete (Beziehungen und Nodes)
```cypher
-- LIKES-Beziehung entfernen
MATCH (u:User {userId: 'user_001'})-[r:LIKES]->(t:Track {trackId: 'trk_001'})
DELETE r

-- FOLLOWS-Beziehung entfernen
MATCH (u1:User {userId: 'user_001'})-[r:FOLLOWS]->(u2:User {userId: 'user_002'})
DELETE r

-- Node und alle Beziehungen löschen
MATCH (t:Track {trackId: 'trk_001'}) DETACH DELETE t
```

---

## 6. Integrations-Use-Case: Mood-basierte Musikempfehlungen

### Beschreibung

Der zentrale Integrations-Use-Case ist das **Mood-basierte Empfehlungssystem**. Es kombiniert beide Datenbanken:

1. **Neo4j** findet über Graph-Traversierung Tracks mit ähnlichen Moods
2. **MongoDB** liefert die vollständigen Track-Details (Titel, Künstler, Genre, Dauer)

### Ablauf (Schritt für Schritt)

```
┌─────────┐        ┌──────────┐        ┌─────────┐        ┌─────────┐
│ Frontend │──(1)──>│ Backend  │──(2)──>│  Neo4j  │──(3)──>│ Backend │
│          │        │          │        │  Graph  │        │         │
│          │        │          │──(4)──>│ MongoDB │──(5)──>│         │──(6)──>│ Frontend │
└─────────┘        └──────────┘        └─────────┘        └─────────┘
```

**Schritt 1**: Frontend ruft `GET /api/integration/recommendations/:userId` auf

**Schritt 2**: Backend fragt Neo4j nach gelikten Tracks des Users:
```cypher
MATCH (u:User {userId: $userId})-[:LIKES]->(liked:Track)
RETURN liked.trackId AS trackId
```

**Schritt 3**: Neo4j traversiert den Graph – findet Tracks mit überlappenden Moods:
```cypher
MATCH (u:User {userId: $userId})-[:LIKES]->(liked:Track)-[:HAS_MOOD]->(mood:Mood)
MATCH (mood)<-[:HAS_MOOD]-(recommended:Track)
WHERE NOT recommended.trackId IN $likedIds
RETURN recommended.trackId AS trackId,
       COUNT(DISTINCT mood) AS sharedMoods
ORDER BY sharedMoods DESC
LIMIT 10
```
→ Ergebnis: Liste von Track-IDs + Anzahl geteilter Moods (Score)

**Schritt 4**: Backend holt vollständige Track-Daten aus MongoDB:
```javascript
await db.collection('tracks').find({
  trackId: { $in: trackIds }
}).toArray();
```

**Schritt 5**: Backend kombiniert Neo4j-Score mit MongoDB-Daten:
```javascript
const enrichedRecommendations = recommendations.map(rec => {
  const track = tracks.find(t => t.trackId === rec.trackId);
  return {
    ...track,                    // Alle MongoDB-Details
    sharedMoods: rec.sharedMoods, // Neo4j-Score
    reason: `Teilt ${rec.sharedMoods} Moods mit deinen Lieblingssongs`
  };
});
```

**Schritt 6**: Frontend zeigt die Empfehlungen mit Titel, Künstler, Genre und Begründung an.

### Fallback-Strategie

Falls ein Nutzer noch keine Tracks geliked hat, greift ein Fallback:
1. **MongoDB** liefert die `preferredMoods` des Nutzers aus dem User-Profil
2. **MongoDB** übersetzt Mood-Namen in Mood-IDs (`moods`-Collection)
3. **Neo4j** findet Tracks mit diesen bevorzugten Moods
4. **MongoDB** liefert wieder die Track-Details

### Hybrid-Aggregation: Genre-Statistik

Ein weiterer Integrations-Use-Case ist die **Genre-Statistik** auf dem Dashboard (`GET /api/playlists/stats/genres`). Diese kombiniert:

1. **MongoDB Aggregation-Pipeline**: Zählt Genres aus den Playlisten des Users
2. **Neo4j Cypher-Abfrage**: Holt die gelikten Track-IDs des Users
3. **MongoDB Aggregation**: Zählt Genres der gelikten Tracks
4. **Backend**: Merged beide Ergebnisse zu einer Gesamt-Genre-Statistik

Diese hybride Abfrage zeigt, wie beide Datenbanken zusammenarbeiten, um ein vollständiges Bild des Musikgeschmacks zu erstellen.
