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

  // Playlist Modal State
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);

  // Genre Stats State
  const [genreStats, setGenreStats] = useState([]);

  useEffect(() => {
    loadData();
    if (user) {
      loadLikedTracks();
      loadGenreStats();
    }
  }, [user]);

  const loadGenreStats = async () => {
    try {
      // Fetch from the aggregation endpoint
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
      const [users, artistsList, albumsList, tracks, playlistsData] = await Promise.all([
        mongoApi.getUsers(),
        mongoApi.getArtists(),
        mongoApi.getAlbums(),
        mongoApi.getTracks(),
        mongoApi.getPlaylists('mine')
      ]);

      // Estimate relationships in Neo4j (Mock calculation for now as Neo4j stats aren't directly available)
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

      // Load recommendations
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

  // Simplified Like Handler - Syncs only with Neo4j
  const handleLike = async (trackId) => {
    // Optimistic Update
    const wasLiked = likedTracks.includes(trackId);
    console.log(`[Dashboard] Toggling like for ${trackId}. Was liked? ${wasLiked}`);

    setLikedTracks(prev => {
      if (wasLiked) return prev.filter(id => id !== trackId);
      return [...prev, trackId];
    });

    try {
      if (wasLiked) {
        // Unlike
        await neo4jApi.removeLike(user.userId, trackId);
        console.log(`[Dashboard] Unliked ${trackId}`);
      } else {
        // Like
        await neo4jApi.addLike({ userId: user.userId, trackId });
        console.log(`[Dashboard] Liked ${trackId}`);
      }

      // Reload recommendations to reflect changes potentially
      if (user) {
        const recs = await integrationApi.getRecommendations(user.userId);
        setRecommendations(recs);
      }

    } catch (e) {
      console.error('[Dashboard] Like failed:', e);
      // Revert on error
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

      // Refresh playlists
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
      // Remove duplicates just in case
      const uniqueIds = [...new Set(newTrackIds)];

      await mongoApi.updatePlaylist(playlist.playlistId, { trackIds: uniqueIds });

      alert(`"${selectedTrack.title}" zu "${playlist.name}" hinzugefügt!`);
      setShowPlaylistModal(false);

      // Refresh playlists
      const p = await mongoApi.getPlaylists('mine');
      setPlaylists(p);

    } catch (e) {
      alert('Fehler: ' + e.message);
    }
  };

  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;
  const albumName = (id) => (albums.find(a => a.albumId === id) || {}).title || '';
  const fmtDur = (s) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '–';

  if (loading) return <div className="loading">Laden…</div>;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Music Knowledge Graph</h1>
          <p className="page-subtitle">Explore relationships between artists, albums, and tracks</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon pink">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.artists.toLocaleString()}</div>
            <div className="stat-label">Artists</div>
          </div>
          <span className="stat-change up">+12%</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan">💿</div>
          <div className="stat-content">
            <div className="stat-value">{stats.albums.toLocaleString()}</div>
            <div className="stat-label">Albums</div>
          </div>
          <span className="stat-change up">+8%</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">🎵</div>
          <div className="stat-content">
            <div className="stat-value">{stats.tracks.toLocaleString()}</div>
            <div className="stat-label">Tracks</div>
          </div>
          <span className="stat-change up">+15%</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🔗</div>
          <div className="stat-content">
            <div className="stat-value">{stats.relationships.toLocaleString()}</div>
            <div className="stat-label">Relationships</div>
          </div>
          <span className="stat-change up">+20%</span>
        </div>
      </div>

      {/* Genre Stats Chart (Aggregation Visualization) */}
      <div className="section-header" style={{ marginTop: 30 }}>
        <div>
          <h2 className="section-title">Dein Musikgeschmack</h2>
          <p className="section-subtitle">Basierend auf deinen Playlisten (Aggregation)</p>
        </div>
      </div>

      {
        genreStats.length > 0 ? (
          <div className="card" style={{ marginBottom: 30, padding: 24 }}>
            {/* Chart Container */}
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 180, gap: 16 }}>
              {genreStats.map((g, i) => {
                const max = Math.max(...genreStats.map(s => s.count));
                // Ensure at least 10% height for visibility if count > 0
                const percentage = (g.count / max) * 100;
                const height = Math.max(percentage, 10);

                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${height}%`,
                      background: `hsl(${i * 60}, 70%, 55%)`, // More distinct colors
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

      {/* Popular Tracks Section (Added from Recommend.js) */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <div>
          <h2 className="section-title">🔥 Von anderen gelikt</h2>
          <p className="section-subtitle">Beliebte Tracks der Community (Global Aggregation)</p>
        </div>
      </div>

      <PopularTracksSection user={user} likedTracks={likedTracks} handleLike={handleLike} openAddToPlaylist={openAddToPlaylist} artists={artists} />

      {/* Recommendations Section */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <div>
          <h2 className="section-title">🎯 Für dich empfohlen</h2>
          <p className="section-subtitle">Basierend auf Stimmung & Likes (Graph Algorithm)</p>
        </div>
      </div>

      <div className="recommendation-list">
        {recommendations?.recommendations?.slice(0, 6).map((track, i) => (
          <div key={i} className="recommendation-card">
            <div
              className="recommendation-image"
              style={{
                background: `linear-gradient(135deg, hsl(${i * 45 + 180}, 70%, 40%), hsl(${i * 45 + 210}, 60%, 30%))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '20px'
              }}
            >
              🎵
            </div>
            <div className="recommendation-info">
              <div className="recommendation-title">{track.title}</div>
              <div className="recommendation-artist">
                {artistName(track.artistId)} • {albumName(track.albumId) || 'Single'}
              </div>
              <div className="recommendation-tags">
                {track.genre && <span className="tag tag-genre">{track.genre}</span>}
                {Array.isArray(track.mood) && track.mood.slice(0, 3).map((m, idx) => (
                  <span key={idx} className="tag tag-mood">{m}</span>
                ))}
              </div>
              {track.reason && (
                <div className="recommendation-reason">{track.reason}</div>
              )}
            </div>
            <div className="recommendation-actions">
              <span className="recommendation-duration">{fmtDur(track.duration_sec)}</span>
              <div className="recommendation-buttons">
                <button
                  className={`btn ${likedTracks.includes(track.trackId) ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => handleLike(track.trackId)}
                >
                  <Icons.Heart filled={likedTracks.includes(track.trackId)} />
                  {likedTracks.includes(track.trackId) ? 'Liked' : 'Like'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => openAddToPlaylist(track)}
                >
                  <Icons.Plus /> Playlist
                </button>
              </div>
            </div>
          </div>
        ))}

        {(!recommendations?.recommendations || recommendations.recommendations.length === 0) && (
          <div className="card" style={{ padding: 40, textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🎵</div>
            <div style={{ color: 'var(--text-md)', marginBottom: 8 }}>Keine persönlichen Empfehlungen verfügbar</div>
            <div style={{ color: 'var(--text-lo)', fontSize: 13 }}>
              {recommendations?.message || 'Like einige Songs um personalisierte Empfehlungen zu erhalten'}
            </div>
          </div>
        )}
      </div>

      {/* Add To Playlist Modal */}
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

// Sub-component for Popular Tracks to keep main component clean
function PopularTracksSection({ user, likedTracks, handleLike, openAddToPlaylist, artists }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    try {
      const allLikes = await neo4jApi.queryAllLikes();
      const myLikes = await neo4jApi.queryUserLikes(user.userId);
      const othersLikes = allLikes.filter(like => !myLikes.includes(like.trackId));

      // Top 4 popular
      const topLikes = othersLikes.slice(0, 4);

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

  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;
  const fmtDur = (s) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '–';

  // SVG Icons for sub-component
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
  if (tracks.length === 0) return <div className="card text-center text-lo p-4">Noch keine beliebten Tracks von anderen.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 30 }}>
      {tracks.map((t, i) => (
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
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}
              onClick={() => handleLike(t.trackId)}
            >
              <Heart filled={false} /> Like
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
      ))}
    </div>
  );
}
