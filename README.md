# 🎵 MelodyGraph – Musikempfehlungs-App
**MongoDB + Neo4j | React + Express**

---

## 📋 Überblick

MelodyGraph ist eine Web-Anwendung zur Verwaltung und Empfehlung von Musik.  
Sie nutzt **MongoDB** für dokumentenbasierte Anwendungsdaten und **Neo4j** für die Modellierung von Beziehungen zwischen Benutzern und Tracks als Graph.

---

## 🏗 Architektur

```
┌─────────────┐   REST/JSON   ┌──────────────┐
│   React     │ ────────────► │   Express    │
│  Frontend   │ ◄──────────── │   Backend    │
│ (Port 3000) │               │  (Port 5000) │
└─────────────┘               └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                 ▼
             ┌──────────┐                    ┌──────────┐
             │ MongoDB  │                    │  Neo4j   │
             │ Port 27017│                   │ Port 7687│
             └──────────┘                    └──────────┘
```

### Datenaufteilung (Kein redundanter Speicher)

| Datenbank | Was wird gespeichert | Begründung |
|-----------|---------------------|------------|
| **MongoDB** | Vollständige Profildaten (Users, Artists, Albums, Tracks, Playlists) | Dokumentenbasierte Daten mit verschachtelten Arrays |
| **Neo4j** | Nur IDs + Beziehungen (User→LIKES→Track, Track→SIMILAR_TO→Track, Track→PERFORMED_BY→Artist) | Graphstruktur für Empfehlungen |

---

## 📂 Projektstruktur

```
musikprojekt/
├── docker-compose.yml          # MongoDB + Neo4j Container
├── backend/
│   ├── .env                    # Umgebungsvariablen
│   ├── package.json
│   └── src/
│       ├── app.js              # Express Hauptanwendung
│       ├── seed.js             # Testdaten laden
│       ├── config/
│       │   ├── mongo.js        # MongoDB Verbindung
│       │   └── neo4j.js        # Neo4j Driver
│       └── routes/
│           ├── users.js        # CRUD Users
│           ├── artists.js      # CRUD Artists
│           ├── albums.js       # CRUD Albums
│           ├── tracks.js       # CRUD Tracks
│           ├── playlists.js    # CRUD Playlists + Aggregation
│           ├── neo4j.js        # Neo4j CRUD + Cypher-Abfragen
│           └── integration.js  # Integrations-Use-Case
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js / index.css
        ├── App.js / App.css
        ├── api.js              # Zentrale API-Funktionen
        └── pages/
            ├── Dashboard.js    # Übersicht + Statistiken
            ├── Users.js        # User CRUD
            ├── Artists.js      # Artist CRUD
            ├── Albums.js       # Album CRUD
            ├── Tracks.js       # Track CRUD + Filter
            ├── Playlists.js    # Playlist CRUD + Aggregation
            ├── Neo4jView.js    # Graph Verwaltung
            └── Recommend.js    # Empfehlungen (Integration)
```

---

## ⚡ Setup & Installation

### 1. Datenbanken starten (Docker)
```bash
docker-compose up -d
```

### 2. Backend installieren & starten
```bash
cd backend
npm install
npm run dev          # oder: npm start
```

### 3. Testdaten laden (einmalig)
```bash
cd backend
node src/seed.js
```

### 4. Frontend installieren & starten
```bash
cd frontend
npm install
npm start            # läuft auf http://localhost:3000
```

---

## 🗄 Datenmodelle

### MongoDB Collections (5)

1. **users** – `{ userId, name, email, favoriteGenres[], createdAt }`
2. **artists** – `{ artistId, name, genre, origin, formedYear }`
3. **albums** – `{ albumId, artistId, title, releaseYear, genre, trackCount, duration_min }`
4. **tracks** – `{ trackId, albumId, artistId, title, duration_sec, genre, mood }`
5. **playlists** – `{ playlistId, userId, name, description, trackIds[], createdAt }`

### Neo4j Graph

**Node-Labels (3):**
- `User` – `{ userId, name }`
- `Artist` – `{ artistId, name, genre }`
- `Track` – `{ trackId, title, genre, mood }`

**Relationship-Typen (3):**
- `(User)-[:LIKES]->(Track)` – Benutzer möchte einen Track
- `(Track)-[:PERFORMED_BY]->(Artist)` – Track gehört zu einem Künstler
- `(Track)-[:SIMILAR_TO]->(Track)` – Zwei Tracks sind ähnlich

---

## 🔍 Cypher-Abfragen (3)

1. **Alle Tracks eines Artists:**
   `MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {artistId: $id}) RETURN t`

2. **Ähnliche Tracks (SIMILAR_TO):**
   `MATCH (t:Track {trackId: $id})-[:SIMILAR_TO]->(s:Track) RETURN s`

3. **Gemochte Tracks eines Users:**
   `MATCH (u:User {userId: $id})-[:LIKES]->(t:Track) RETURN t`

---

## 🔗 Integrations-Use-Case

**Empfehlung basierend auf LIKES + SIMILAR_TO:**

1. Neo4j: Finde alle Tracks, die ähnlich zu vom User gemochten Tracks sind
2. Neo4j: Filtere bereits gemochte Tracks heraus → gibt nur Track-IDs zurück
3. MongoDB: Lade die vollständigen Daten für diese Track-IDs (Dauer, Album, Artist)
4. Backend: Vereinigt Neo4j-Graphdaten mit MongoDB-Detaildaten

---

## 📊 Aggregation Pipeline

**Playlist mit aufgelösten Tracks:**
- `$lookup` auf `tracks`-Collection
- Berechnet `totalDuration` und `trackCount`
- Gibt aufgelöste Track-Objekte zurück

**Genre-Statistiken:**
- `$unwind` der trackIds
- `$lookup` auf tracks
- `$group` nach Genre mit Count
- Sortiert absteigend
