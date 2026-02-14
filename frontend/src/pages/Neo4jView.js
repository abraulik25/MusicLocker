import React, { useState, useEffect } from 'react';
import { neo4jApi, mongoApi } from '../api';
import { useAuth } from '../AuthContext';

export default function Neo4jView() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchArtists, setSearchArtists] = useState('');
  const [searchMoods, setSearchMoods] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      if (!user) return;
      // 1. Zuerst holen wir alle gelikten Song-IDs aus Neo4j
      const likedTrackIds = await neo4jApi.queryUserLikes(user.userId);

      // 2. Dann laden wir alle Song-Details und Künstler aus der MongoDB
      const [tracks, artists] = await Promise.all([
        mongoApi.getTracks(),
        mongoApi.getArtists()
      ]);

      // 3. Wir verknüpfen die Daten: Nur gelikte Songs behalten + Künstlernamen hinzufügen
      const likedTracks = tracks.filter(t => likedTrackIds.includes(t.trackId))
        .map(t => {
          const artist = artists.find(a => a.artistId === t.artistId);
          return { ...t, artistName: artist ? artist.name : 'Unbekannt' };
        });

      // Statistik: Welche Künstler hören wir am meisten?
      const artistCounts = {};
      likedTracks.forEach(t => {
        if (!artistCounts[t.artistId]) artistCounts[t.artistId] = 0;
        artistCounts[t.artistId]++;
      });

      // Liste der Top-Künstler erstellen
      const userArtists = artists
        .filter(a => artistCounts[a.artistId])
        .map(a => ({
          ...a,
          count: artistCounts[a.artistId]
        }))
        .sort((a, b) => b.count - a.count);

      // Statistik: Welche Moods (Stimmungen) kommen oft vor?
      const moodCounts = {};
      likedTracks.forEach(t => {
        const tMoods = Array.isArray(t.mood) ? t.mood : (t.mood ? [t.mood] : []);
        tMoods.forEach(m => {
          if (!moodCounts[m]) moodCounts[m] = 0;
          moodCounts[m]++;
        });
      });

      // Liste der Top-Moods erstellen
      const userMoods = Object.keys(moodCounts)
        .map(m => ({ name: m, count: moodCounts[m] }))
        .sort((a, b) => b.count - a.count);

      setData({
        likedTracks,
        userArtists,
        userMoods
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [showModal, setShowModal] = useState(false);

  const handleUnlike = async (trackId) => {
    try {
      // Optimistisch: Wir tun so, als ob es schon weg wäre (damit es sich schneller anfühlt)
      console.log('Unliking track:', trackId);
      await neo4jApi.removeLike(user.userId, trackId);
      await loadData(); // Daten neu laden, damit die Liste aktuell bleibt
    } catch (e) { console.error('Error unliking:', e); }
  };

  if (loading) return <div className="loading">Laden…</div>;

  if (!data) return null;

  const { likedTracks, userArtists, userMoods } = data;

  const filteredArtists = userArtists.filter(a => a.name.toLowerCase().includes(searchArtists.toLowerCase()));
  const filteredMoods = userMoods.filter(m => m.name.toLowerCase().includes(searchMoods.toLowerCase()));

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div><h1>Deine Connections</h1><span className="subtitle">Dein persönliches Netzwerk</span></div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Deine Musik-Connections</h2>
        <p className="text-lo">Basierend auf {likedTracks.length} gelikten Songs</p>
      </div>

      <div className="connections-grid">
        {/* LINKE SPALTE: KÜNSTLER */}
        <div className="conn-card">
          <div className="conn-header">
            <div className="conn-icon" style={{ background: 'var(--accent-lo)', color: 'var(--accent)' }}>🎵</div>
            <div>
              <div className="conn-title">Deine Künstler</div>
              <div className="conn-subtitle">{userArtists.length} Künstler</div>
              <input
                type="text"
                placeholder="Suchen..."
                value={searchArtists}
                onChange={e => setSearchArtists(e.target.value)}
                className="search-input-sm"
                style={{ marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: 13 }}
              />
            </div>
          </div>
          <div className="conn-list">
            {filteredArtists.length > 0 ? filteredArtists.map(a => (
              <div key={a.artistId} className="conn-item">
                <span>{a.name}</span>
                <span className="conn-count">{a.count} Song{a.count !== 1 && 's'}</span>
              </div>
            )) : (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-lo)', fontSize: 13 }}>Keine Künstler gefunden.</div>
            )}
          </div>
        </div>

        {/* MITTLERE SPALTE: PROFIL */}
        <div className="conn-card center-card">
          <div className="profile-avatar-lg">
            <div className="profile-initials">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>{user.name}</h2>
          <p className="text-sm text-lo mb-6">{user.email}</p>

          <div className="stats-container">
            <div
              className="stat-box"
              onClick={() => setShowModal(true)}
              style={{ cursor: 'pointer', border: '1px solid var(--accent)', background: 'rgba(56, 189, 248, 0.1)' }}
              title="Klicken für Details"
            >
              <div className="stat-val">{likedTracks.length}</div>
              <div className="stat-lbl">Gelikte Songs ↗</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="stat-box">
                <div className="stat-val">{userArtists.length}</div>
                <div className="stat-lbl">Künstler</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{userMoods.length}</div>
                <div className="stat-lbl text-xs">Verschiedene Moods</div>
              </div>
            </div>
          </div>
        </div>

        {/* RECHTE SPALTE: MOODS */}
        <div className="conn-card">
          <div className="conn-header">
            <div className="conn-icon" style={{ background: 'var(--pink-lo)', color: 'var(--pink)' }}>✨</div>
            <div>
              <div className="conn-title">Deine Moods</div>
              <div className="conn-subtitle">{userMoods.length} Stimmungen</div>
              <input
                type="text"
                placeholder="Suchen..."
                value={searchMoods}
                onChange={e => setSearchMoods(e.target.value)}
                className="search-input-sm"
                style={{ marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: 13 }}
              />
            </div>
          </div>
          <div className="conn-list">
            {filteredMoods.length > 0 ? filteredMoods.map(m => (
              <div key={m.name} className="conn-item">
                <span>{m.name}</span>
                <span className="conn-count">{m.count} Song{m.count !== 1 && 's'}</span>
              </div>
            )) : (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-lo)', fontSize: 13 }}>Keine Moods gefunden.</div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Details für gelikte Songs */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: 800, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 24 }}>🎵 Deine Gelikten Songs & Moods</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-md)', fontSize: 24, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: 12, color: 'var(--text-lo)' }}>Titel</th>
                    <th style={{ padding: 12, color: 'var(--text-lo)' }}>Künstler</th>
                    <th style={{ padding: 12, color: 'var(--text-lo)' }}>Moods / Stimmung</th>
                    <th style={{ padding: 12, color: 'var(--text-lo)', textAlign: 'right' }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {likedTracks.map(t => (
                    <tr key={t.trackId} style={{ borderBottom: '1px solid var(--border-lo)' }}>
                      <td style={{ padding: 12, fontWeight: 600 }}>{t.title}</td>
                      <td style={{ padding: 12, color: 'var(--text-md)' }}>{t.artistName}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(Array.isArray(t.mood) ? t.mood : (t.mood ? [t.mood] : [])).map((m, i) => {
                            // Einfacher Hash für konsistente Farben
                            let hash = 0;
                            for (let j = 0; j < m.length; j++) hash = m.charCodeAt(j) + ((hash << 5) - hash);
                            const h = Math.abs(hash) % 360;
                            const colorStyle = {
                              fontSize: 12,
                              backgroundColor: `hsl(${h}, 70%, 35%)`,
                              color: 'white',
                              border: 'none'
                            };
                            return (
                              <span key={i} className="tag tag-mood" style={colorStyle}>
                                {m}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleUnlike(t.trackId)}
                          title="Entfernen"
                        >
                          💔
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {likedTracks.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-lo)' }}>
                  Noch keine Songs geliked.
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 20, textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
