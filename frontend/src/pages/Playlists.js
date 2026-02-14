import React, { useState, useEffect } from 'react';
import { mongoApi, neo4jApi } from '../api';
import { useAuth } from '../AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY = { userId: '', name: '', description: '', trackIds: [], isPublic: false };

// SVG Icons
const Icons = {
  X: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
};

export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]); // Für Lieblingssongs
  const [likedAlbumsList, setLikedAlbumsList] = useState([]); // Für Gelikte Alben Tab
  const [users, setUsers] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [form, setForm] = useState(EMPTY);
  const [searchQuery, setSearchQuery] = useState('');
  const [aggView, setAggView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mine'); // 'mine', 'following', 'albums' oder 'discover'
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const canModify = (playlist) => {
    if (isAdmin) return true;
    if (playlist.createdBy === user?.userId) return true;
    return false;
  };

  const load = async () => {
    try {
      const [u, t, a] = await Promise.all([
        mongoApi.getUsers().catch(() => []),
        mongoApi.getTracks(),
        mongoApi.getArtists()
      ]);
      setUsers(u);
      setTracks(t);
      setArtists(a);

      setArtists(a);

      // Gelikte Songs laden (für die virtuelle "Lieblingssongs"-Playlist)
      if (user) {
        const liked = await neo4jApi.queryUserLikes(user.userId);
        setLikedTracks(liked);
      }

      // Playlisten laden (je nach ausgewähltem Tab)
      let p = [];
      if (activeTab === 'mine') {
        p = await mongoApi.getPlaylists('mine');
      } else if (activeTab === 'following') {
        p = await mongoApi.getFollowingPlaylists();
      } else if (activeTab === 'discover') {
        p = await mongoApi.getDiscoverPlaylists();
      } else if (activeTab === 'albums') {
        // Alle Alben laden und nur die behalten, die wir geliked haben
        const [allAlbums, likedAlbumIds] = await Promise.all([
          mongoApi.getAlbums(),
          neo4jApi.queryUserLikedAlbums(user.userId)
        ]);
        const userLikedAlbums = allAlbums.filter(a => likedAlbumIds.includes(a.albumId));
        setPlaylists(userLikedAlbums);
        setLikedAlbumsList(userLikedAlbums);
      }
      if (activeTab !== 'albums') setPlaylists(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeTab, user]);

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit = (p) => {
    setForm({
      userId: p.userId,
      name: p.name,
      description: p.description || '',
      trackIds: [...(p.trackIds || [])],
      isPublic: p.isPublic || false
    });
    setModal({ ...p });
  };
  const close = () => {
    setModal(null);
    setAggView(null);
  };

  const toggleTrack = (tid) => {
    setForm(prev => ({
      ...prev,
      trackIds: prev.trackIds.includes(tid) ? prev.trackIds.filter(i => i !== tid) : [...prev.trackIds, tid]
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { alert('Name erforderlich'); return; }
    try {
      const payload = { ...form, userId: form.userId || user.userId };
      if (modal === 'create') {
        await mongoApi.createPlaylist(payload);
      } else {
        await mongoApi.updatePlaylist(modal.playlistId, payload);
      }
      close();
      await load();
    } catch (e) { alert('Fehler: ' + e.message); }
  };

  const handleDelete = (playlistId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Playlist löschen',
      message: 'Möchtest du diese Playlist wirklich löschen?',
      onConfirm: async () => {
        try {
          await mongoApi.deletePlaylist(playlistId);
          await load();
        } catch (e) { alert('Fehler: ' + e.message); }
      }
    });
  };

  const handleUnlike = async (trackId) => {
    try {
      await neo4jApi.removeLike(user.userId, trackId);
      // Lokalen State aktualisieren
      setLikedTracks(prev => prev.filter(id => id !== trackId));
      // Detail-Ansicht aktualisieren, falls offen
      if (aggView && aggView.isVirtual) {
        setAggView(prev => ({
          ...prev,
          trackIds: prev.trackIds.filter(id => id !== trackId)
        }));
      }
    } catch (e) { console.error(e); }
  };

  const calculateDuration = (trackIds) => {
    if (!trackIds || !Array.isArray(trackIds)) return 0;
    const totalSec = trackIds.reduce((acc, tid) => {
      const t = tracks.find(tr => tr.trackId === tid);
      return acc + (parseInt(t?.duration_sec) || 0);
    }, 0);
    return Math.round(totalSec / 60);
  };

  const userName = (id) => (users.find(u => u.userId === id) || {}).name || id;
  const trackTitle = (id) => (tracks.find(t => t.trackId === id) || {}).title || id;
  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;

  if (loading) return <div style={{ color: 'var(--text-lo)', marginTop: 60, textAlign: 'center' }}>Laden…</div>;

  // Virtuelle "Lieblingssongs"-Playlist erstellen (nur bei "Meine Playlisten")
  const lieblingssongs = {
    playlistId: 'virtual_lieblingssongs',
    name: '❤️ Lieblingssongs',
    description: 'Alle deine gelikten Tracks',
    userId: user?.userId,
    trackIds: likedTracks,
    isVirtual: true,
    isPublic: false,
    createdBy: user?.userId
  };

  // Virtuelle Playlist mit echten kombinieren (nur im "Mine"-Tab)
  let allPlaylists = activeTab === 'mine' ? [lieblingssongs, ...playlists] : playlists;

  // Suche in den Playlisten nach Name oder Beschreibung
  const filteredPlaylists = allPlaylists.filter(p => {
    const pName = p.name || '';
    const matchesName = pName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDesc = (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesName || matchesDesc;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Playlisten</h1><span className="subtitle">Verwalte deine Musik-Sammlungen</span></div>
        <button className="btn btn-primary" onClick={openCreate}>+ Neue Playlist</button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={`tab ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>
          📁 Meine Playlisten
        </button>
        <button className={`tab ${activeTab === 'albums' ? 'active' : ''}`} onClick={() => setActiveTab('albums')}>
          💿 Gelikte Alben
        </button>
        <button className={`tab ${activeTab === 'following' ? 'active' : ''}`} onClick={() => setActiveTab('following')}>
          👥 Following
        </button>
        <button className={`tab ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')}>
          🌍 Entdecken
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 18 }}>
        <input
          type="text"
          className="input"
          placeholder={activeTab === 'albums' ? "🔍 Alben durchsuchen..." : "🔍 Playlisten durchsuchen..."}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {activeTab === 'albums' ? (
        // ALBEN RENDERN
        <div>
          <div style={{ marginBottom: 14 }}>
            <span className="info-badge">💿 {likedAlbumsList.length} Album{likedAlbumsList.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {likedAlbumsList.filter(a => (a.title || '').toLowerCase().includes(searchQuery.toLowerCase())).map(a => (
              <div key={a.albumId} className="card" style={{ padding: 18 }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="avatar avatar-sm" style={{ borderRadius: 6, fontSize: 24, width: 48, height: 48 }}>💿</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{a.title}</div>
                    <div className="text-sm text-lo">{artistName(a.artistId)}</div>
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <span className="tag bg-gray-800 text-gray-300">{a.genre}</span>
                  <span className="tag bg-gray-800 text-gray-300">{a.releaseYear}</span>
                </div>
                <div className="text-sm text-lo mb-3">
                  {a.trackCount} Tracks • {a.duration_min} min
                </div>
              </div>
            ))}
          </div>
          {likedAlbumsList.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-lo)' }}>
              Du hast noch keine Alben geliked. Gehe zum Reiter 'Alben' und like welche!
            </div>
          )}
        </div>
      ) : (
        // PLAYLISTEN RENDERN
        <>
          {/* Statistik */}
          <div style={{ marginBottom: 14 }}>
            <span className="info-badge">📋 {filteredPlaylists.length} Playlist{filteredPlaylists.length !== 1 ? 'en' : ''}</span>
            {activeTab === 'mine' && lieblingssongs.trackIds.length > 0 && (
              <span className="info-badge" style={{ marginLeft: 8, background: 'var(--accent-lo)', color: 'var(--accent)' }}>
                ❤️ {lieblingssongs.trackIds.length} Lieblingssongs
              </span>
            )}
          </div>

          {/* Liste der Playlisten */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filteredPlaylists.map(p => (
              <div key={p.playlistId} className="card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => setAggView(p)}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {p.isVirtual && (
                      <span style={{ fontSize: 11, background: 'var(--accent-lo)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>
                        Auto
                      </span>
                    )}
                    {!p.isVirtual && (
                      <span style={{ fontSize: 11, background: p.isPublic ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)', color: p.isPublic ? 'rgb(16, 185, 129)' : 'var(--text-lo)', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>
                        {p.isPublic ? '🌍 Öffentlich' : '🔒 Privat'}
                      </span>
                    )}
                  </div>
                </div>
                {p.description && <div className="text-sm text-md" style={{ marginBottom: 10 }}>{p.description}</div>}

                {/* Dauer und Anzahl der Tracks */}
                <div className="text-sm text-lo">
                  👤 {userName(p.userId)} • 🎵 {(p.trackIds || []).length} Tracks • ⏱️ {calculateDuration(p.trackIds)} min
                </div>

                {!p.isVirtual && activeTab === 'mine' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    {canModify(p) && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>✏️ Bearbeiten</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.playlistId)}>🗑️</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredPlaylists.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-lo)' }}>
              {activeTab === 'following' ? 'Folge Benutzern, um deren öffentliche Playlisten zu sehen' :
                activeTab === 'discover' ? 'Keine öffentlichen Playlisten zum Entdecken' :
                  searchQuery ? `Keine Playlisten gefunden für "${searchQuery}"` : 'Keine Playlisten vorhanden'}
            </div>
          )}
        </>
      )}

      {/* Playlist-Detailansicht (Modal) */}
      {aggView && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2>{aggView.name}</h2>
                <span className="text-sm text-lo">{aggView.isPublic ? '🌍 Öffentlich' : aggView.isVirtual ? 'Auto' : '🔒 Privat'}</span>
              </div>
              <button className="modal-close" onClick={close}><Icons.X /></button>
            </div>
            <div className="modal-body">
              {aggView.description && <p className="text-md" style={{ marginBottom: 16 }}>{aggView.description}</p>}

              {/* Dauer und Info */}
              <div className="text-sm text-lo" style={{ marginBottom: 18 }}>
                👤 {userName(aggView.userId)} • 🎵 {(aggView.trackIds || []).length} Tracks • ⏱️ {calculateDuration(aggView.trackIds)} min
              </div>

              {(aggView.trackIds || []).length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Titel</th>
                        <th>Künstler</th>
                        {aggView.isVirtual && <th style={{ textAlign: 'right' }}>Aktion</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(aggView.trackIds || []).map((tid, i) => {
                        const track = tracks.find(t => t.trackId === tid);
                        return (
                          <tr key={tid}>
                            <td style={{ width: 40 }}>{i + 1}</td>
                            <td>{track?.title || tid}</td>
                            <td className="text-sm text-lo">{track ? artistName(track.artistId) : '—'}</td>
                            {aggView.isVirtual && (
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnlike(tid);
                                  }}
                                  title="Unlink/Remove"
                                >
                                  💔
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-lo)' }}>
                  {aggView.isVirtual ? 'Like Tracks, um sie hier zu sehen!' : 'Noch keine Tracks in dieser Playlist'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Playlist erstellen/bearbeiten */}
      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2>{modal === 'create' ? 'Neue Playlist' : 'Playlist bearbeiten'}</h2>
              <button className="modal-close" onClick={close}><Icons.X /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="label">Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Meine Playlist" />
              </div>
              <div className="form-row">
                <label className="label">Beschreibung</label>
                <textarea className="input" rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
              </div>
              <div className="form-row">
                <label className="label">Sichtbarkeit</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="visibility"
                      checked={!form.isPublic}
                      onChange={() => setForm({ ...form, isPublic: false })}
                    />
                    <span>🔒 Privat (nur du)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="visibility"
                      checked={form.isPublic}
                      onChange={() => setForm({ ...form, isPublic: true })}
                    />
                    <span>🌍 Öffentlich (für Follower sichtbar)</span>
                  </label>
                </div>
              </div>
              <div className="form-row">
                <label className="label">Tracks verwalten ({form.trackIds.length})</label>

                {/* Suche zum Hinzufügen */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      placeholder="Song oder Künstler suchen..."
                      onChange={e => {
                        const val = e.target.value.toLowerCase();
                        if (!val) {
                          document.getElementById('track-search-results').style.display = 'none';
                          return;
                        }
                        const results = tracks.filter(t =>
                          t.title.toLowerCase().includes(val) ||
                          artistName(t.artistId).toLowerCase().includes(val)
                        ).slice(0, 10);

                        const resultContainer = document.getElementById('track-search-results');
                        resultContainer.innerHTML = '';
                        resultContainer.style.display = results.length ? 'block' : 'none';

                        results.forEach(t => {
                          const div = document.createElement('div');
                          div.className = 'search-result-item';
                          div.style.padding = '8px';
                          div.style.cursor = 'pointer';
                          div.style.borderBottom = '1px solid var(--border)';
                          div.style.background = 'var(--bg-card)';
                          div.innerHTML = `<div style="font-weight:600">${t.title}</div><div style="font-size:12px;color:var(--text-lo)">${artistName(t.artistId)}</div>`;
                          div.onclick = () => {
                            toggleTrack(t.trackId);
                            e.target.value = '';
                            resultContainer.style.display = 'none';
                          };
                          resultContainer.appendChild(div);
                        });
                      }}
                    />
                  </div>
                  <div id="track-search-results" style={{
                    display: 'none',
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    zIndex: 10,
                    maxHeight: 200,
                    overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}></div>
                </div>

                {/* Liste der ausgewählten Tracks */}
                <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg-hover)' }}>
                  {form.trackIds.length === 0 ? (
                    <div className="text-sm text-lo text-center py-4">Noch keine Tracks ausgewählt. Suche oben, um welche hinzuzufügen!</div>
                  ) : (
                    form.trackIds.map(tid => {
                      const t = tracks.find(tr => tr.trackId === tid);
                      return (
                        <div key={tid} style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-lo)' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{t?.title || tid}</div>
                            <div className="text-xs text-lo">{t ? artistName(t.artistId) : '—'}</div>
                          </div>
                          <button
                            onClick={() => toggleTrack(tid)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                            title="Entfernen"
                          >
                            <Icons.X />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={close}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{modal === 'create' ? 'Erstellen' : 'Speichern'}</button>
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
