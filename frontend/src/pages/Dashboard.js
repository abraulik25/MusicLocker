import React, { useState, useEffect } from 'react';
import { mongoApi, integrationApi, neo4jApi } from '../api';
import { useAuth } from '../AuthContext';

// SVG Icons
const Icons = {
  Heart: ({ filled }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  ),
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

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, artists: 0, albums: 0, tracks: 0, relationships: 0 });
  const [recommendations, setRecommendations] = useState(null);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedTracks, setLikedTracks] = useState([]);
  const [allTracks, setAllTracks] = useState([]); // Store all tracks for lookup

  // Playlist Modal State
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);

  // Liked Songs Modal State
  const [showModal, setShowModal] = useState(false);

  // Genre Stats State
  const [genreStats, setGenreStats] = useState([]);

  useEffect(() => {
    loadData();
    if (user) {
      loadLikedTracks();
      loadGenreStats();
    }
  }, [user]);

  // Scroll Lock Effect
  // Verhindert das Scrollen im Hintergrund, wenn ein Modal offen ist
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto'; // oder 'unset'
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showModal]);

  const loadGenreStats = async () => {
    try {
      // Aggregierte Daten aus der Datenbank holen
      const res = await mongoApi.getGenreStats();
      setGenreStats(res);
    } catch (e) { console.error('Error loading genre stats:', e); }
  };

  const loadLikedTracks = async () => {
    if (!user) return;
    try {
      const liked = await neo4jApi.queryUserLikes(user.userId);
      console.log('[Dashboard] Loaded liked tracks:', liked);
      setLikedTracks(liked);
    } catch (e) { console.error(e); }
  };

  const loadData = async () => {
    try {
      // Wir laden alle wichtigen Daten parallel, damit es schneller geht
      const [users, artistsList, albumsList, tracks, playlistsData] = await Promise.all([
        mongoApi.getUsers(),
        mongoApi.getArtists(),
        mongoApi.getAlbums(),
        mongoApi.getTracks(),
        mongoApi.getPlaylists('mine')
      ]);

      // Schätzung der Beziehungen in Neo4j (nur für die Statistik-Anzeige)
      const relationships = users.length * 3 + tracks.length * 2 + artistsList.length * 2;

      setStats({
        artists: artistsList.length,
        albums: albumsList.length,
        tracks: tracks.length,
        relationships: relationships
      });
      setArtists(artistsList);
      setAlbums(albumsList);
      setPlaylists(playlistsData);
      setAllTracks(tracks); // Alle Tracks speichern für die Suche

      // Empfehlungen für den User laden
      if (user) {
        const recs = await integrationApi.getRecommendations(user.userId);
        setRecommendations(recs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Like Toggle mit "Optimistic Update"
  // Das heißt: Wir färben das Herz SOFORT rot, auch wenn der Server noch arbeitet.
  const handleLike = async (trackId) => {
    const wasLiked = likedTracks.includes(trackId);
    console.log(`[Dashboard] Toggling like for ${trackId}. Was liked? ${wasLiked}`);

    setLikedTracks(prev => {
      if (wasLiked) return prev.filter(id => id !== trackId);
      return [...prev, trackId];
    });

    try {
      if (wasLiked) {
        // Unlike: Verbindung in Neo4j löschen
        await neo4jApi.removeLike(user.userId, trackId);
        console.log(`[Dashboard] Unliked ${trackId}`);
      } else {
        // Like: Verbindung in Neo4j erstellen
        await neo4jApi.addLike({ userId: user.userId, trackId });
        console.log(`[Dashboard] Liked ${trackId}`);
      }

      // Empfehlungen aktualisieren, da sich der Geschmack geändert hat
      if (user) {
        const recs = await integrationApi.getRecommendations(user.userId);
        setRecommendations(recs);
      }

    } catch (e) {
      console.error('[Dashboard] Like failed:', e);
      // Falls ein Fehler passiert, machen wir die Änderung rückgängig (Rollback)
      setLikedTracks(prev => {
        if (wasLiked) return [...prev, trackId];
        return prev.filter(id => id !== trackId);
      });
    }
  };

  const openAddToPlaylist = (track) => {
    setSelectedTrack(track);
    setShowPlaylistModal(true);
  };

  const handleCreatePlaylist = async () => {
    try {
      const name = prompt("Name der neuen Playlist:");
      if (!name) return;

      await mongoApi.createPlaylist({
        name,
        description: 'Erstellt via Dashboard',
        isPublic: false,
        userId: user.userId,
        trackIds: []
      });

      // Playlisten aktualisieren (damit die neue Liste sofort da ist)
      const p = await mongoApi.getPlaylists('mine');
      setPlaylists(p);
    } catch (e) {
      alert("Fehler: " + e.message);
    }
  };

  const handleAddToPlaylist = async (playlist) => {
    if (!selectedTrack) return;
    try {
      const newTrackIds = [...(playlist.trackIds || []), selectedTrack.trackId];
      // Duplikate vermeiden (falls der Song schon drin ist)
      const uniqueIds = [...new Set(newTrackIds)];

      await mongoApi.updatePlaylist(playlist.playlistId, { trackIds: uniqueIds });

      // Kein nerviges Alert mehr, einfach loggen und schließen
      console.log(`Added ${selectedTrack.title} to ${playlist.name}`);
      setShowPlaylistModal(false);

      // Playlisten neu laden
      const p = await mongoApi.getPlaylists('mine');
      setPlaylists(p);

    } catch (e) {
      console.error('Fehler: ' + e.message);
    }
  };

  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;
  const albumName = (id) => (albums.find(a => a.albumId === id) || {}).title || '';
  const fmtDur = (s) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '–';

  if (loading) return <div className="loading">Laden…</div>;

  return (
    <div>
      {/* Seiten-Titel und Untertitel */}
      <div className="page-header">
        <div><h1>Dein Dashboard</h1><span className="subtitle">Entdecke deine Musik-Statistiken in Echtzeit</span></div>
      </div>

      {/* Statistik-Reihe ganz oben */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon pink">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.artists.toLocaleString()}</div>
            <div className="stat-label">Artists</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan">💿</div>
          <div className="stat-content">
            <div className="stat-value">{stats.albums.toLocaleString()}</div>
            <div className="stat-label">Albums</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">🎵</div>
          <div className="stat-content">
            <div className="stat-value">{stats.tracks.toLocaleString()}</div>
            <div className="stat-label">Tracks</div>
          </div>
        </div>
        {/* Klick auf die Herz-Karte öffnet das "Gelikte Songs" Modal */}
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setShowModal(true)}>
          <div className="stat-icon green">❤️</div>
          <div className="stat-content">
            <div className="stat-value">{likedTracks.length}</div>
            <div className="stat-label">Liked Songs</div>
          </div>
          <span className="stat-change">Liste ansehen ↗</span>
        </div>
      </div>

      {/* Genre Statistik (Diagramm) */}
      <div className="section-header" style={{ marginTop: 30 }}>
        <div>
          <h2 className="section-title">Dein Musikgeschmack</h2>
          <p className="section-subtitle">Basierend auf deinen Playlisten</p>
        </div>
      </div>

      {
        genreStats.length > 0 ? (
          <div className="card" style={{ marginBottom: 30, padding: 24 }}>
            {/* Diagramm-Container */}
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 180, gap: 16 }}>
              {genreStats.map((g, i) => {
                const max = Math.max(...genreStats.map(s => s.count));
                const percentage = (g.count / max) * 100;
                const height = Math.max(percentage, 10);

                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${height}%`,
                      background: `hsl(${i * 60}, 70%, 55%)`,
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                      position: 'relative',
                      minHeight: 20
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: -24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-hi)'
                      }}>
                        {g.count}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-md)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {g._id || 'Unbekannt'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 30, padding: 24, textAlign: 'center', color: 'var(--text-lo)' }}>
            Erstelle Playlisten mit Tracks, um deine Genre-Statistik zu sehen!
          </div>
        )
      }

      {/* Beliebte Tracks Sektion */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <div>
          <h2 className="section-title">🔥 Von anderen gelikt</h2>
          <p className="section-subtitle">Beliebte Tracks der Community</p>
        </div>
      </div>

      <PopularTracksSection user={user} likedTracks={likedTracks} handleLike={handleLike} openAddToPlaylist={openAddToPlaylist} artists={artists} />

      {/* Empfehlungen Sektion */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <div>
          <h2 className="section-title">🎯 Für dich empfohlen</h2>
          <p className="section-subtitle">Basierend auf Stimmung & Likes</p>
        </div>
      </div>

      {/* Empfehlungen anzeigen (Liste) */}
      <div className="recommendation-list">
        {recommendations?.recommendations?.slice(0, 6).map((track, i) => (
          // ... (Karte wird hier gerendert) ...
          <div key={i} className="recommendation-card">
            {/* ... Inhalt ... */}
            <div className="recommendation-image" style={{ background: `linear-gradient(135deg, hsl(${i * 45 + 180}, 70%, 40%), hsl(${i * 45 + 210}, 60%, 30%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px' }}>🎵</div>
            <div className="recommendation-info">
              <div className="recommendation-title">{track.title}</div>
              <div className="recommendation-artist">{artistName(track.artistId)} • {albumName(track.albumId)}</div>
              <div className="recommendation-tags">
                {track.genre && <span className="tag tag-genre">{track.genre}</span>}
                {Array.isArray(track.mood) && track.mood.slice(0, 3).map((m, idx) => (<span key={idx} className="tag tag-mood">{m}</span>))}
              </div>
              {track.reason && <div className="recommendation-reason">{track.reason}</div>}
            </div>
            <div className="recommendation-actions">
              <span className="recommendation-duration">{fmtDur(track.duration_sec)}</span>
              <div className="recommendation-buttons">
                <button className={`btn ${likedTracks.includes(track.trackId) ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleLike(track.trackId)}>
                  <Icons.Heart filled={likedTracks.includes(track.trackId)} /> {likedTracks.includes(track.trackId) ? 'Liked' : 'Like'}
                </button>
                <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => openAddToPlaylist(track)}>
                  <Icons.Plus /> Playlist
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal für gelikte Songs (Details) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ maxWidth: 800, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: 20, flexShrink: 0 }}>
              <h2 style={{ fontSize: 24 }}>🎵 Deine Gelikten Songs</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-md)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            <div className="modal-body scrollbar-custom" style={{ overflowY: 'auto', flex: 1, paddingRight: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: 12, color: 'var(--text-lo)' }}>Titel</th>
                    <th style={{ padding: 12, color: 'var(--text-lo)' }}>Künstler</th>
                    <th style={{ padding: 12, color: 'var(--text-lo)', textAlign: 'right' }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {likedTracks.length === 0 ? (
                    <tr><td colSpan="3" style={{ padding: 20, textAlign: 'center', color: 'var(--text-lo)' }}>Noch keine Songs geliked.</td></tr>
                  ) : (
                    // Wir haben nur die IDs der gelikten Songs, holen uns aber die Details aus "allTracks"
                    likedTracks.map(trackId => {
                      // Track-Infos suchen (falls nicht gefunden, Fallback anzeigen)
                      const t = allTracks.find(tr => tr.trackId === trackId)
                        || { title: 'Track ' + trackId, artistId: 'Unknown' };

                      return (
                        <tr key={trackId} style={{ borderBottom: '1px solid var(--border-lo)' }}>
                          <td style={{ padding: 12, fontWeight: 600 }}>{t.title}</td>
                          <td style={{ padding: 12, color: 'var(--text-md)' }}>{artistName(t.artistId)}</td>
                          <td style={{ padding: 12, textAlign: 'right' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleLike(trackId)}
                              title="Like entfernen"
                              style={{ color: 'var(--accent)' }}
                            >
                              💔
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 20, textAlign: 'right', flexShrink: 0 }}>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}


      {/* Modal: Song zu Playlist hinzufügen */}
      {
        showPlaylistModal && (
          <div className="modal-overlay" onClick={() => setShowPlaylistModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 className="text-xl font-bold">Song zu Playlist hinzufügen</h3>
                <button className="modal-close" onClick={() => setShowPlaylistModal(false)}><Icons.X /></button>
              </div>
              <p className="mb-4 text-lo">Wähle eine Playlist für "{selectedTrack?.title}"</p>

              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4">
                {playlists.length > 0 ? playlists.map(p => (
                  <button
                    key={p.playlistId}
                    className="btn btn-secondary text-left justify-start"
                    onClick={() => handleAddToPlaylist(p)}
                  >
                    🎵 {p.name}
                  </button>
                )) : (
                  <div className="text-center text-lo py-4">Keine Playlists gefunden.</div>
                )}
              </div>

              <div className="flex justify-between items-center mt-4 border-t pt-4 border-gray-700">
                <button className="btn btn-primary btn-sm" onClick={handleCreatePlaylist}>
                  <span style={{ marginRight: 6 }}><Icons.Plus /></span> Neue Playlist erstellen
                </button>
                <button className="btn" onClick={() => setShowPlaylistModal(false)}>Abbrechen</button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

// ... existing imports ...

// Hilfskomponente für die "Beliebten Tracks", damit die Hauptdatei übersichtlich bleibt
function PopularTracksSection({ user, likedTracks, handleLike, openAddToPlaylist, artists }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Nur neu laden, wenn sich der User ändert (nicht bei jedem Like, sonst flackert es)
  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    try {
      const allLikes = await neo4jApi.queryAllLikes();
      const topLikes = allLikes.slice(0, 6);

      if (topLikes.length > 0) {
        const allTracks = await mongoApi.getTracks();
        const resolved = topLikes.map(like => {
          const t = allTracks.find(tr => tr.trackId === like.trackId);
          return t ? { ...t, likeCount: like.likeCount } : null;
        }).filter(Boolean);
        setTracks(resolved);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLocalLike = async (trackId) => {
    // 1. Optimistisches Update berechnen
    const isLiked = likedTracks.includes(trackId);
    const delta = isLiked ? -1 : 1;

    // 2. Lokalen State sofort aktualisieren (für schnelle Reaktion)
    setTracks(prev => prev.map(t => {
      if (t.trackId === trackId) {
        return { ...t, likeCount: Math.max(0, t.likeCount + delta) };
      }
      return t;
    }));

    // 3. Parent-Handler aufrufen (aktualisiert die Datenbank und globalen State)
    await handleLike(trackId);
  };

  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;
  const fmtDur = (s) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '–';

  // SVG Icons für diese Komponente
  const Heart = ({ filled }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  );
  const Plus = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );

  if (loading) return <div className="card text-center text-lo p-4">Laden...</div>;
  if (tracks.length === 0) return <div className="card text-center text-lo p-4">Noch keine beliebten Tracks.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 30 }}>
      {tracks.map((t, i) => {
        const isLiked = likedTracks.includes(t.trackId);
        return (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div className="flex items-center justify-between mb-2">
              <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{t.title}</div>
              <span style={{ background: 'rgba(236, 72, 153, 0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                ❤️ {t.likeCount}
              </span>
            </div>
            <div className="text-sm text-lo mb-3">
              <div>🎤 {artistName(t.artistId)}</div>
            </div>
            <div className="flex gap-2">
              <button
                className={`btn btn-sm ${isLiked ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}
                onClick={() => handleLocalLike(t.trackId)}
              >
                <Heart filled={isLiked} /> {isLiked ? 'Liked' : 'Like'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}
                onClick={() => openAddToPlaylist(t)}
              >
                <Plus /> Add
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
