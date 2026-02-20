import React, { useState, useEffect } from 'react';
import { mongoApi, neo4jApi } from '../api';
import { useAuth } from '../AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY = { artistId: '', title: '', releaseYear: '', genre: '', trackCount: '', duration_min: '' };

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

export default function Albums() {
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [likedAlbums, setLikedAlbums] = useState([]); // Visual visual state only for now
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const canModify = (album) => {
    if (isAdmin) return true;
    if (album.createdBy === user?.userId) return true;
    return false;
  };

  const load = async () => {
    try {
      const [a, ar] = await Promise.all([mongoApi.getAlbums(), mongoApi.getArtists()]);
      setAlbums(a); setArtists(ar);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadLikedAlbums = async () => {
    if (!user) return;
    try {
      console.log("[Albums] Loading liked albums for:", user.userId);
      const liked = await neo4jApi.queryUserLikedAlbums(user.userId);
      console.log("[Albums] Liked albums loaded:", liked);
      setLikedAlbums(liked);
    } catch (e) { console.error("[Albums] Failed to load likes:", e); }
  };

  useEffect(() => {
    load();
    if (user) loadLikedAlbums();
  }, [user]);

  const openCreate = () => {
    setForm(EMPTY);
    setModal('create');
  };

  const openEdit = (album) => {
    setForm(album);
    setModal('edit');
  };

  const close = () => {
    setModal(null);
    setForm(EMPTY);
  };

  const handleSubmit = async () => {
    try {
      if (modal === 'create') {
        const res = await mongoApi.createAlbum({ ...form, createdBy: user.userId });
        if (res.albumId) {
          // Auch im Neo4j-Graph erstellen (für Empfehlungen)
          await neo4jApi.createAlbum({ albumId: res.albumId });
        }
      } else {
        await mongoApi.updateAlbum(form.albumId, form);
      }
      close();
      load();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  const handleDelete = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Album löschen',
      message: 'Möchtest du dieses Album wirklich löschen?',
      confirmText: 'Löschen',
      onConfirm: async () => {
        try {
          await mongoApi.deleteAlbum(id);
          await neo4jApi.deleteAlbum(id);
          load();
        } catch (e) {
          console.error(e);
          alert(e.message);
        }
      }
    });
  };

  const handleLike = async (id) => {
    console.log("[Albums] Toggling like for album:", id);
    if (!user || !user.userId) {
      console.error("[Albums] No user logged in or missing userId");
      alert("Fehler: Nicht eingeloggt?");
      return;
    }
    if (!neo4jApi) {
      console.error("[Albums] neo4jApi is missing!");
      alert("Interner Fehler: API nicht verfügbar");
      return;
    }

    const wasLiked = likedAlbums.includes(id);
    setLikedAlbums(prev => wasLiked ? prev.filter(i => i !== id) : [...prev, id]);

    try {
      if (wasLiked) {
        console.log("[Albums] Removing like...");
        await neo4jApi.removeAlbumLike(user.userId, id);
      } else {
        console.log("[Albums] Adding like...");
        await neo4jApi.addAlbumLike({ userId: user.userId, albumId: id });
      }
      console.log("[Albums] Like action successful");
    } catch (e) {
      console.error("[Albums] Like action failed:", e);
      // Revert on error
      setLikedAlbums(prev => wasLiked ? [...prev, id] : prev.filter(i => i !== id));
    }
  };

  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAlbums = [...albums].sort((a, b) => {
    if (sortConfig.key === 'title') {
      return sortConfig.direction === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
    }
    if (sortConfig.key === 'artist') {
      const nA = artistName(a.artistId);
      const nB = artistName(b.artistId);
      return sortConfig.direction === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
    }
    if (sortConfig.key === 'genre') {
      return sortConfig.direction === 'asc' ? (a.genre || '').localeCompare(b.genre || '') : (b.genre || '').localeCompare(a.genre || '');
    }
    if (sortConfig.key === 'releaseYear') {
      return sortConfig.direction === 'asc' ? (a.releaseYear || 0) - (b.releaseYear || 0) : (b.releaseYear || 0) - (a.releaseYear || 0);
    }
    if (sortConfig.key === 'duration') {
      return sortConfig.direction === 'asc' ? (a.duration_min || 0) - (b.duration_min || 0) : (b.duration_min || 0) - (a.duration_min || 0);
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

  if (loading) return <div style={{ color: 'var(--text-lo)', marginTop: 60, textAlign: 'center' }}>Laden…</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Alben</h1><span className="subtitle">Verwalte Alben deiner Sammlung</span></div>
        <button className="btn btn-primary" onClick={openCreate}>+ Neues Album</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {isAdmin && <th>ID</th>}
              <th onClick={() => handleSort('title')} style={headerStyle('title')}>
                Titel <SortIcon column="title" />
              </th>
              <th onClick={() => handleSort('artist')} style={headerStyle('artist')}>
                Künstler <SortIcon column="artist" />
              </th>
              <th onClick={() => handleSort('genre')} style={headerStyle('genre')}>
                Genre <SortIcon column="genre" />
              </th>
              <th onClick={() => handleSort('releaseYear')} style={{ ...headerStyle('releaseYear'), textAlign: 'center' }}>
                Veröffentlicht <SortIcon column="releaseYear" />
              </th>
              <th style={{ textAlign: 'center' }}>Tracks</th>
              <th onClick={() => handleSort('duration')} style={{ ...headerStyle('duration'), textAlign: 'center' }}>
                Dauer <SortIcon column="duration" />
              </th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortedAlbums.map(a => (
              <tr key={a.albumId}>
                {isAdmin && <td><span className="tag tag-pink">{a.albumId}</span></td>}
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar avatar-sm" style={{ borderRadius: 6 }}>💿</div>
                    <span>{a.title}</span>
                  </div>
                </td>
                <td>{artistName(a.artistId)}</td>
                <td><span className="tag">{a.genre}</span></td>
                <td style={{ textAlign: 'center' }}>{a.releaseYear}</td>
                <td style={{ textAlign: 'center' }}>{a.trackCount}</td>
                <td style={{ textAlign: 'center' }}>{a.duration_min} min</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <div className="flex gap-2 items-center">
                    <button
                      className={`action-icon like ${likedAlbums.includes(a.albumId) ? 'active' : ''}`}
                      onClick={() => handleLike(a.albumId)}
                      title={likedAlbums.includes(a.albumId) ? 'Unlike' : 'Like'}
                    >
                      <Icons.Heart filled={likedAlbums.includes(a.albumId)} />
                    </button>
                    <button
                      className="action-icon edit"
                      onClick={() => openEdit(a)}
                      disabled={!canModify(a)}
                      title={!canModify(a) ? 'Nur Ersteller können bearbeiten' : 'Bearbeiten'}
                      style={{ opacity: !canModify(a) ? 0.3 : 1 }}
                    >
                      <Icons.Edit />
                    </button>
                    <button
                      className="action-icon delete"
                      onClick={() => handleDelete(a.albumId)}
                      disabled={!canModify(a)}
                      title={!canModify(a) ? 'Nur Ersteller können löschen' : 'Löschen'}
                      style={{ opacity: !canModify(a) ? 0.3 : 1 }}
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'create' ? 'Neues Album' : 'Album bearbeiten'}</h3>
            <div className="flex flex-col gap-3">
              <div className="form-row">
                <label className="label">Künstler</label>
                <select className="input" value={form.artistId} onChange={e => setForm({ ...form, artistId: e.target.value })} style={{ background: 'var(--bg-hover)' }}>
                  <option value="" disabled>Auswählen…</option>
                  {artists.map(a => <option key={a.artistId} value={a.artistId}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label className="label">Titel</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="form-grid">
                <div className="form-row"><label className="label">Genre</label><input className="input" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} /></div>
                <div className="form-row"><label className="label">Veröffentlicht</label><input className="input" type="number" value={form.releaseYear} onChange={e => setForm({ ...form, releaseYear: e.target.value })} /></div>
                <div className="form-row"><label className="label">Anzahl Tracks</label><input className="input" type="number" value={form.trackCount} onChange={e => setForm({ ...form, trackCount: e.target.value })} /></div>
                <div className="form-row"><label className="label">Dauer (min)</label><input className="input" type="number" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={close}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Speichern</button>
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
