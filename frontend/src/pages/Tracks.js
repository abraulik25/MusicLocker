import React, { useState, useEffect } from 'react';
import { mongoApi, neo4jApi } from '../api';
import { useAuth } from '../AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY = { artistId: '', artistName: '', artistOrigin: '', artistFormedYear: '', albumId: '', title: '', duration_sec: '', genre: '', mood: [] };

// SVG Icons (selbst definiert, statt einer externen Library)
const Icons = {
  Heart: ({ filled }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  ),
  // ... andere Icons
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Edit: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
  Trash: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  X: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
};

const MOODS = [
  'Happy', 'Sad', 'Energetic', 'Calm', 'Romantic',
  'Melancholic', 'Uplifting', 'Dark', 'Chill', 'Intense',
  'Dreamy', 'Aggressive', 'Peaceful', 'Nostalgic', 'Mysterious', 'Epic', 'Groovy', 'Powerful', 'Atmospheric', 'Technical',
  'Rebellious', 'Catchy', 'Sunny', 'Classic', 'Dramatic'
];

const GENRES = [
  'Rock', 'Pop', 'Jazz', 'Classical', 'Electronic', 'Hip-Hop',
  'R&B', 'Country', 'Blues', 'Reggae', 'Metal', 'Punk',
  'Folk', 'Soul', 'Funk', 'Disco', 'House', 'Techno',
  'Ambient', 'Trip-Hop', 'Indie', 'Alternative', 'Progressive Rock', 'Glam Rock', 'Hard Rock'
];

export default function Tracks() {
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [playlists, setPlaylists] = useState([]); // Playlists laden für "Add to Playlist"
  const [modal, setModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [form, setForm] = useState(EMPTY);
  const [filterArtist, setFA] = useState('');
  const [filterGenre, setFG] = useState('');
  const [filterMood, setFM] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [likedTracks, setLikedTracks] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });

  // Playlist-Modal Status
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const load = async () => {
    try {
      const [t, a, al, p] = await Promise.all([
        mongoApi.getTracks(),
        mongoApi.getArtists(),
        mongoApi.getAlbums(),
        mongoApi.getPlaylists('mine') // Playlisten laden
      ]);
      setTracks(t); setArtists(a); setAlbums(al); setPlaylists(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadLikedTracks = async () => {
    if (!user) return;
    try {
      const liked = await neo4jApi.queryUserLikes(user.userId);
      console.log('[Tracks] Loaded liked tracks:', liked);
      setLikedTracks(liked);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    if (user) loadLikedTracks();
  }, [user]);

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit = (t) => {
    const moods = Array.isArray(t.mood) ? t.mood : (t.mood ? [t.mood] : []);
    setForm({
      artistId: t.artistId,
      artistName: '',
      albumId: t.albumId || '',
      title: t.title,
      duration_sec: t.duration_sec || '',
      genre: t.genre || '',
      mood: moods
    });
    setModal({ ...t });
  };
  const close = () => setModal(null);

  const toggleMood = (moodName) => {
    setForm(prev => ({
      ...prev,
      mood: prev.mood.includes(moodName)
        ? prev.mood.filter(m => m !== moodName)
        : [...prev.mood, moodName]
    }));
  };

  const canModify = (track) => {
    if (isAdmin) return true;
    if (track.createdBy === user?.userId) return true;
    return false;
  };

  const handleSubmit = async () => {
    try {
      let artistId = form.artistId;

      // Neuen Künstler erstellen, wenn ein Name eingegeben wurde
      if (form.artistName && form.artistName.trim()) {
        const newArtist = await mongoApi.createArtist({
          name: form.artistName.trim(),
          genre: form.genre,
          origin: form.artistOrigin || '',
          formedYear: form.artistFormedYear ? parseInt(form.artistFormedYear) : null
        });
        artistId = newArtist.artistId;

        // Künstler auch in Neo4j anlegen
        await neo4jApi.createArtist({
          artistId: newArtist.artistId,
          name: newArtist.name,
          genre: newArtist.genre
        });
      }

      if (!artistId) {
        alert('Bitte wählen Sie einen Künstler oder geben Sie einen neuen Namen ein');
        return;
      }

      const payload = {
        artistId: artistId,
        albumId: form.albumId || null,
        title: form.title,
        duration_sec: form.duration_sec ? parseInt(form.duration_sec) : 0,
        genre: form.genre,
        mood: form.mood
      };

      if (modal === 'create') {
        const created = await mongoApi.createTrack(payload);
        await neo4jApi.createTrack({
          trackId: created.trackId,
          title: created.title,
          genre: created.genre,
          mood: created.mood,
          artistId: created.artistId
        });
      } else {
        await mongoApi.updateTrack(modal.trackId, payload);
      }
      close(); await load();
    } catch (e) { alert('Fehler: ' + e.message); }
  };

  const handleDelete = (trackId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Track löschen',
      message: 'Möchtest du diesen Track wirklich aus der Datenbank entfernen?',
      onConfirm: async () => {
        try {
          await mongoApi.deleteTrack(trackId);
          await neo4jApi.deleteTrack(trackId);
          await load();
        } catch (e) { alert('Fehler: ' + e.message); }
      }
    });
  };

  // Eigener "Like"-Handler: Aktualisiert nur die lokale Anzeige und Neo4j
  // Die "Lieblingssongs" Playlist wird in Playlists.js direkt aus Neo4j geladen
  const handleLike = async (trackId) => {
    // 1. Optimistic Update: Wir zeigen das Herz SOFORT rot an
    const wasLiked = likedTracks.includes(trackId);
    console.log(`[Tracks] Toggling like for ${trackId}. Was liked? ${wasLiked}`);

    // UI sofort aktualisieren, bevor die Datenbank antwortet
    setLikedTracks(prev => {
      if (wasLiked) return prev.filter(id => id !== trackId);
      return [...prev, trackId];
    });

    try {
      if (wasLiked) {
        // Unlike: Verbindung in Neo4j entfernen
        await neo4jApi.removeLike(user.userId, trackId);
        console.log(`[Tracks] Unliked ${trackId} in Neo4j`);
      } else {
        // Like: Verbindung in Neo4j erstellen
        await neo4jApi.addLike({ userId: user.userId, trackId });
        console.log(`[Tracks] Liked ${trackId} in Neo4j`);
      }
    } catch (e) {
      console.error('[Tracks] Like API failed:', e);
      alert('Fehler: ' + e.message);
      // Falls was schief geht: Herz wieder zurücksetzen (Rollback)
      setLikedTracks(prev => {
        if (wasLiked) return [...prev, trackId]; // Wieder hinzufügen
        return prev.filter(id => id !== trackId); // Oder wieder entfernen
      });
    }
  };

  // Playlist Logik
  const openAddToPlaylist = (track) => {
    setSelectedTrack(track);
    setShowPlaylistModal(true);
  };

  const [creationSuccess, setCreationSuccess] = useState(false);

  const handleCreatePlaylist = async (nameInput) => {
    try {
      const name = nameInput;
      if (!name || !name.trim()) return;

      await mongoApi.createPlaylist({
        name,
        description: 'Erstellt via Song-Tab',
        isPublic: false,
        userId: user.userId,
        trackIds: []
      });

      // Playlisten aktualisieren
      const p = await mongoApi.getPlaylists('mine');
      setPlaylists(p);

      // Eingabefeld leeren
      const input = document.getElementById('new-playlist-name-input');
      if (input) input.value = '';

      // Feedback anzeigen (statt nervigem Alert)
      setCreationSuccess(true);
      setTimeout(() => setCreationSuccess(false), 2000);

    } catch (e) {
      alert("Fehler: " + e.message);
    }
  };

  const handleAddToPlaylist = async (playlist) => {
    if (!selectedTrack) return;
    try {
      const newTrackIds = [...(playlist.trackIds || []), selectedTrack.trackId];
      const uniqueIds = [...new Set(newTrackIds)];

      await mongoApi.updatePlaylist(playlist.playlistId, { trackIds: uniqueIds });

      // Hinweis: Wir liken den Song hier NICHT automatisch, um Komplexität zu vermeiden

      // Modal sofort schließen (weniger aufdringlich als ein Alert)
      setShowPlaylistModal(false);

      // Wir könnten hier einen "Toast" anzeigen, aber ein Log reicht erstmal (User sieht, dass es zugeht)
      console.log(`"${selectedTrack.title}" hinzugefügt!`);

      // Optional: Playlisten neu laden, um den Counter im UI zu updaten
      const p = await mongoApi.getPlaylists('mine');
      setPlaylists(p);
    } catch (e) {
      alert('Fehler: ' + e.message);
    }
  };

  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;
  const albumName = (id) => (albums.find(a => a.albumId === id) || {}).title || '';

  const availableGenres = [...new Set([...GENRES, ...tracks.map(t => t.genre).filter(Boolean)])];

  const filtered = tracks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterArtist && t.artistId !== filterArtist) return false;
    if (filterGenre && t.genre !== filterGenre) return false;
    if (filterMood) {
      const trackMoods = Array.isArray(t.mood) ? t.mood : (t.mood ? [t.mood] : []);
      if (!trackMoods.includes(filterMood)) return false;
    }
    return true;
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFilteredTracks = [...filtered].sort((a, b) => {
    if (sortConfig.key === 'title') {
      return sortConfig.direction === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    }
    if (sortConfig.key === 'artist') {
      const nameA = artistName(a.artistId);
      const nameB = artistName(b.artistId);
      return sortConfig.direction === 'asc'
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    }
    if (sortConfig.key === 'genre') {
      const genreA = a.genre || '';
      const genreB = b.genre || '';
      return sortConfig.direction === 'asc'
        ? genreA.localeCompare(genreB)
        : genreB.localeCompare(genreA);
    }
    if (sortConfig.key === 'duration') {
      return sortConfig.direction === 'asc'
        ? (a.duration_sec || 0) - (b.duration_sec || 0)
        : (b.duration_sec || 0) - (a.duration_sec || 0);
    }
    return 0;
  });

  const SortIcon = ({ column }) => {
    const isActive = sortConfig.key === column;
    return (
      <span style={{ marginLeft: 6, display: 'inline-block', width: 12, textAlign: 'center', color: isActive ? 'var(--accent)' : 'var(--text-lo)' }}>
        {isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    );
  };

  const headerStyle = (column) => ({
    cursor: 'pointer',
    userSelect: 'none',
    color: sortConfig.key === column ? 'var(--accent)' : 'inherit',
    transition: 'color 0.2s'
  });

  const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (loading) return <div className="loading">Laden…</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Lieder</h1><span className="subtitle">Verwalte Lieder deiner Sammlung</span></div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={openCreate}>+ Neues Lied</button>
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-4">
          <div>
            <h2 className="section-title">Alle Lieder</h2>
            <p className="section-subtitle">{sortedFilteredTracks.length} von {tracks.length} Liedern</p>
          </div>
        </div>

        {/* Filter-Leiste */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="input"
              placeholder="Lieder suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-4 items-center flex-wrap">
            <select className="input" style={{ width: 220 }} value={filterArtist} onChange={e => setFA(e.target.value)}>
              <option value="">Alle Künstler</option>
              {artists.map(a => <option key={a.artistId} value={a.artistId}>{a.name}</option>)}
            </select>
            <select className="input" style={{ width: 180 }} value={filterGenre} onChange={e => setFG(e.target.value)}>
              <option value="">Alle Genres</option>
              {availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="input" style={{ width: 180 }} value={filterMood} onChange={e => setFM(e.target.value)}>
              <option value="">Alle Moods</option>
              {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {(filterArtist || filterGenre || filterMood || search) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setFA(''); setFG(''); setFM(''); setSearch(''); }}
              >
                ✕ Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap" style={{ background: 'transparent', border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('title')} style={headerStyle('title')}>
                  Titel <SortIcon column="title" />
                </th>
                <th onClick={() => handleSort('artist')} style={headerStyle('artist')}>
                  Künstler <SortIcon column="artist" />
                </th>
                <th>Album</th>
                <th onClick={() => handleSort('genre')} style={headerStyle('genre')}>
                  Genre <SortIcon column="genre" />
                </th>
                <th>Moods</th>
                <th onClick={() => handleSort('duration')} style={{ ...headerStyle('duration'), textAlign: 'center' }}>
                  Dauer <SortIcon column="duration" />
                </th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredTracks.map(t => {
                const trackMoods = Array.isArray(t.mood) ? t.mood : (t.mood ? [t.mood] : []);
                return (
                  <tr key={t.trackId}>
                    <td style={{ fontWeight: 600, color: 'var(--text-hi)' }}>{t.title}</td>
                    <td>{artistName(t.artistId)}</td>
                    <td className="text-sm text-lo">{albumName(t.albumId) || '–'}</td>
                    <td><span className="tag tag-genre">{t.genre}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {trackMoods.length > 0 ? trackMoods.slice(0, 3).map(m => (
                          <span key={m} className="tag tag-mood">{m}</span>
                        )) : <span className="text-lo text-sm">–</span>}
                        {trackMoods.length > 3 && <span className="text-xs text-lo">+{trackMoods.length - 3}</span>}
                      </div>
                    </td>
                    <td className="text-sm text-lo" style={{ textAlign: 'center' }}>{fmtDur(t.duration_sec)}</td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <button
                          className={`action-icon like ${likedTracks.includes(t.trackId) ? 'active' : ''}`}
                          onClick={() => handleLike(t.trackId)}
                          title={likedTracks.includes(t.trackId) ? 'Unlike' : 'Like'}
                        >
                          <Icons.Heart filled={likedTracks.includes(t.trackId)} />
                        </button>
                        <button
                          className="action-icon"
                          onClick={() => openAddToPlaylist(t)}
                          title="Zu Playlist hinzufügen"
                        >
                          <Icons.Plus />
                        </button>
                        <button
                          className="action-icon edit"
                          onClick={() => openEdit(t)}
                          disabled={!canModify(t)}
                          title="Bearbeiten"
                          style={{ opacity: !canModify(t) ? 0.2 : 1 }}
                        >
                          <Icons.Edit />
                        </button>
                        <button
                          className="action-icon delete"
                          onClick={() => handleDelete(t.trackId)}
                          disabled={!canModify(t)}
                          title="Löschen"
                          style={{ opacity: !canModify(t) ? 0.2 : 1 }}
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedFilteredTracks.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🎵</div>
              <div className="empty-state-title">Keine Lieder gefunden</div>
              <div className="empty-state-text">Passe deine Filter an oder suche nach einem anderen Titel</div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>{modal === 'create' ? 'Neues Lied' : 'Lied bearbeiten'}</h3>
            </div>
            {/* Formular-Inhalt */}
            <div className="flex flex-col gap-4">
              <div className="form-row">
                <label className="label">Künstler</label>
                <select
                  className="input"
                  value={form.artistId}
                  onChange={e => setForm({ ...form, artistId: e.target.value, artistName: '' })}
                  disabled={modal !== 'create'}
                >
                  <option value="">Neuen Künstler erstellen...</option>
                  {artists.map(a => <option key={a.artistId} value={a.artistId}>{a.name}</option>)}
                </select>
              </div>

              {modal === 'create' && !form.artistId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Neuer Künstlername</label>
                    <input
                      className="input"
                      value={form.artistName}
                      onChange={e => setForm({ ...form, artistName: e.target.value })}
                      placeholder="Name des neuen Künstlers eingeben..."
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">Herkunft</label>
                    <input
                      className="input"
                      value={form.artistOrigin}
                      onChange={e => setForm({ ...form, artistOrigin: e.target.value })}
                      placeholder="z.B. London, UK"
                    />
                  </div>
                  <div className="form-row">
                    <label className="label">Gründungsjahr</label>
                    <input
                      className="input"
                      type="number"
                      value={form.artistFormedYear}
                      onChange={e => setForm({ ...form, artistFormedYear: e.target.value })}
                      placeholder="z.B. 1995"
                    />
                  </div>
                </div>
              )}

              <div className="form-row"><label className="label">Titel</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div className="form-row">
                  <label className="label">Album</label>
                  <select className="input" value={form.albumId} onChange={e => setForm({ ...form, albumId: e.target.value })}>
                    <option value="">Kein Album (Single)</option>
                    {albums.filter(a => a.artistId === form.artistId).map(a => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
                  </select>
                </div>
                <div className="form-row"><label className="label">Dauer (Sek)</label><input className="input" type="number" value={form.duration_sec} onChange={e => setForm({ ...form, duration_sec: e.target.value })} /></div>
              </div>

              <div className="form-row">
                <label className="label">Genre</label>
                <select className="input" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })}>
                  <option value="">Genre auswählen...</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label className="label">Moods ({form.mood.length})</label>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, background: 'var(--bg-hover)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {MOODS.map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={form.mood.includes(m)}
                        onChange={() => toggleMood(m)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span style={{ color: form.mood.includes(m) ? 'var(--accent)' : 'var(--text-md)' }}>{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={close}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Zur Playlist hinzufügen */}
      {showPlaylistModal && (
        <div className="modal-overlay" onClick={() => setShowPlaylistModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="text-xl font-bold">Song zu Playlist hinzufügen</h3>
              <button
                className="modal-close"
                onClick={() => setShowPlaylistModal(false)}
              >
                <Icons.X />
              </button>
            </div>

            <p className="mb-4 text-lo">Wähle eine Playlist für "{selectedTrack?.title}"</p>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4 custom-scrollbar">
              {playlists.length > 0 ? playlists.map(p => (
                <button
                  key={p.playlistId}
                  className="btn btn-secondary text-left justify-start"
                  onClick={() => handleAddToPlaylist(p)}
                  style={{ padding: '10px 14px' }}
                >
                  <span style={{ marginRight: 8 }}>🎵</span> {p.name}
                  <span className="text-xs text-lo ml-auto">({(p.trackIds || []).length} Songs)</span>
                </button>
              )) : (
                <div className="text-center text-lo py-4">Keine Playlists gefunden.</div>
              )}
            </div>

            <div className="mt-4 border-t pt-4 border-gray-700">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-md)' }}>Oder neue Playlist erstellen:</div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Name der neuen Playlist..."
                  id="new-playlist-name-input"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(document.getElementById('new-playlist-name-input').value); }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleCreatePlaylist(document.getElementById('new-playlist-name-input').value)}
                  style={{ minWidth: 40, background: creationSuccess ? 'var(--stat-green)' : 'var(--accent)' }}
                >
                  {creationSuccess ? '✔' : <Icons.Plus />}
                </button>
              </div>
              {creationSuccess && <div style={{ fontSize: 12, color: 'var(--stat-green)', marginTop: 4, textAlign: 'right' }}>Playlist erstellt!</div>}
            </div>
          </div>
        </div>
      )}
      {/* Bestätigungs-Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}
