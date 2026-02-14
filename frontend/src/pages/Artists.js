import React, { useState, useEffect } from 'react';
import { mongoApi, neo4jApi } from '../api';
import { useAuth } from '../AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY = { name: '', genre: '', origin: '', formedYear: '' };

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

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [likedArtists, setLikedArtists] = useState([]); // Visual visual state only for now
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const canModify = (artist) => {
    if (isAdmin) return true;
    if (artist.createdBy === user?.userId) return true;
    return false;
  };

  const load = async () => {
    try { setArtists(await mongoApi.getArtists()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit = (a) => { setForm({ name: a.name, genre: a.genre, origin: a.origin || '', formedYear: a.formedYear || '' }); setModal({ ...a }); };
  const close = () => setModal(null);

  const handleSubmit = async () => {
    const payload = { name: form.name, genre: form.genre, origin: form.origin, formedYear: form.formedYear ? parseInt(form.formedYear) : null };
    try {
      if (modal === 'create') {
        const created = await mongoApi.createArtist(payload);
        await neo4jApi.createArtist({ artistId: created.artistId, name: created.name, genre: created.genre });
      } else {
        await mongoApi.updateArtist(modal.artistId, payload);
      }
      close(); await load();
    } catch (e) { alert('Fehler: ' + e.message); }
  };

  const handleDelete = (artistId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Künstler löschen',
      message: 'Möchtest du diesen Künstler wirklich löschen? Alle zugehörigen Alben und Tracks bleiben bestehen, aber die Verknüpfung geht verloren.',
      onConfirm: async () => {
        try {
          await mongoApi.deleteArtist(artistId);
          await neo4jApi.deleteArtist(artistId);
          await load();
        } catch (e) { alert('Fehler: ' + e.message); }
      }
    });
  };

  const handleLike = (id) => {
    // Nur optisch umschalten (Backend noch nicht fertig)
    setLikedArtists(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  if (loading) return <div className="loading">Laden…</div>;

  const filtered = artists.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.genre || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFilteredArtists = [...filtered].sort((a, b) => {
    if (sortConfig.key === 'name') {
      return sortConfig.direction === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    if (sortConfig.key === 'genre') {
      const gA = a.genre || '';
      const gB = b.genre || '';
      return sortConfig.direction === 'asc'
        ? gA.localeCompare(gB)
        : gB.localeCompare(gA);
    }
    if (sortConfig.key === 'origin') {
      const oA = a.origin || '';
      const oB = b.origin || '';
      return sortConfig.direction === 'asc'
        ? oA.localeCompare(oB)
        : oB.localeCompare(oA);
    }
    if (sortConfig.key === 'formedYear') {
      return sortConfig.direction === 'asc'
        ? (a.formedYear || 0) - (b.formedYear || 0)
        : (b.formedYear || 0) - (a.formedYear || 0);
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

  return (
    <div>
      {/* Seiten-Header */}
      <div className="page-header">
        <div><h1>Künstler</h1><span className="subtitle">Verwalte Künstler und Bands</span></div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={openCreate}>+ Neuer Künstler</button>
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-4">
          <div>
            <h2 className="section-title">Künstler-Datenbank</h2>
            <p className="section-subtitle">{filtered.length} Einträge</p>
          </div>
        </div>

        {/* Suchfeld */}
        <div className="search-input-wrap mb-6">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Künstler suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap" style={{ background: 'transparent', border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Bild</th>
                <th onClick={() => handleSort('name')} style={headerStyle('name')}>
                  Name <SortIcon column="name" />
                </th>
                <th onClick={() => handleSort('origin')} style={headerStyle('origin')}>
                  Herkunft <SortIcon column="origin" />
                </th>
                <th onClick={() => handleSort('formedYear')} style={{ ...headerStyle('formedYear'), textAlign: 'center' }}>
                  Gründungsjahr <SortIcon column="formedYear" />
                </th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredArtists.map((a, i) => (
                <tr key={a.artistId}>
                  <td>
                    <div
                      className="avatar"
                      style={{
                        borderRadius: 12,
                        width: 48,
                        height: 48,
                        background: `linear-gradient(135deg, hsl(${i * 45 + 180}, 60%, 50%), hsl(${i * 45 + 230}, 60%, 40%))`,
                        fontSize: 20
                      }}
                    >
                      {a.genre === 'Rock' ? '🎸' : a.genre === 'Pop' ? '🎤' : '🎵'}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span style={{ fontWeight: 600, color: 'var(--text-hi)' }}>{a.name}</span>
                      <span className="text-sm text-lo">{a.genre}</span>
                    </div>
                  </td>
                  <td className="text-sm">{a.origin || '–'}</td>
                  <td className="text-sm" style={{ textAlign: 'center' }}>{a.formedYear || '–'}</td>
                  <td>
                    <div className="flex gap-2 items-center">
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
                        onClick={() => handleDelete(a.artistId)}
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
          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🎤</div>
              <div className="empty-state-title">Keine Künstler gefunden</div>
              <div className="empty-state-text">Versuche es mit einem anderen Suchbegriff</div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'create' ? 'Neuer Künstler' : 'Künstler bearbeiten'}</h3>
            <div className="flex flex-col gap-4">
              <div className="form-row"><label className="label">Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label className="label">Genre</label><input className="input" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-row"><label className="label">Herkunft</label><input className="input" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} /></div>
                <div className="form-row"><label className="label">Gründungsjahr</label><input className="input" type="number" value={form.formedYear} onChange={e => setForm({ ...form, formedYear: e.target.value })} /></div>
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
