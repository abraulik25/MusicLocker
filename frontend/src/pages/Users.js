import React, { useState, useEffect } from 'react';
import { mongoApi } from '../api';
import { useAuth } from '../AuthContext';
import ConfirmModal from '../components/ConfirmModal';

// SVG Icons
const Icons = {
  Trash: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  UserPlus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="8.5" cy="7" r="4"></circle>
      <line x1="20" y1="8" x2="20" y2="14"></line>
      <line x1="23" y1="11" x2="17" y2="11"></line>
    </svg>
  ),
  UserCheck: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="8.5" cy="7" r="4"></circle>
      <polyline points="17 11 19 13 23 9"></polyline>
    </svg>
  )
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const u = await mongoApi.getUsers();
      setUsers(u);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleFollow = async (userId) => {
    try {
      await mongoApi.followUser(userId);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnfollow = async (targetUserId) => {
    try {
      await mongoApi.unfollowUser(targetUserId);
      await load();
    } catch (e) {
      alert("Fehler beim Entfolgen: " + e.message);
    }
  };

  const handleDelete = (u) => {
    setConfirmModal({
      isOpen: true,
      title: 'Benutzer löschen',
      message: `Möchtest du den Benutzer "${u.name}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`,
      onConfirm: async () => {
        try {
          await mongoApi.deleteUser(u.userId);
          await load();
        } catch (e) { console.error(e); }
      }
    });
  };

  if (loading) return <div className="loading">Laden…</div>;

  // Benutzer filtern
  // Admins sehen alle, normale User sehen keine Admins
  const visibleUsers = users
    .filter(u => isAdmin || u.role !== 'admin')
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()));

  const isFollowing = (userId) => {
    const currentUserData = users.find(u => u.userId === user.userId);
    return currentUserData?.following?.includes(userId) || false;
  };

  return (
    <div>
      {/* Seiten-Header */}
      <div className="page-header">
        <div><h1>Community</h1><span className="subtitle">Finde und folge anderen Musikliebhabern</span></div>
      </div>

      <div className="card">
        <div className="section-header mb-4">
          <div>
            <h2 className="section-title">Benutzerverzeichnis</h2>
            <p className="section-subtitle">{visibleUsers.length} registrierte Benutzer</p>
          </div>
        </div>

        {/* Suchfeld */}
        <div className="search-input-wrap mb-6">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Benutzer suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap" style={{ background: 'transparent', border: 'none' }}>
          <table>
            <thead>
              <tr>
                {isAdmin && <th>ID</th>}
                <th>Profilbild</th>
                <th>Name</th>
                <th>Kontakt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u, i) => (
                <tr key={u.userId}>
                  {isAdmin && <td><span className="tag tag-pink">{u.userId}</span></td>}
                  <td>
                    <div
                      className="avatar"
                      style={{
                        background: `linear-gradient(135deg, hsl(${i * 60}, 70%, 50%), hsl(${i * 60 + 30}, 70%, 50%))`,
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span style={{ fontWeight: 600, color: 'var(--text-hi)' }}>{u.name}</span>
                      {u.role === 'admin' && <span className="tag text-xs" style={{ width: 'fit-content', marginTop: 2 }}>Admin</span>}
                    </div>
                  </td>
                  <td>
                    <span className="text-sm text-lo">{u.email}</span>
                  </td>
                  <td>
                    <div className="flex gap-2 items-center">
                      {u.userId !== user.userId && (
                        isFollowing(u.userId) ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => handleUnfollow(u.userId)}
                          >
                            <Icons.UserCheck /> <span className="hidden md:inline">Folge ich</span>
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => handleFollow(u.userId)}
                          >
                            <Icons.UserPlus /> <span className="hidden md:inline">Folgen</span>
                          </button>
                        )
                      )}

                      {isAdmin && u.userId !== user.userId && (
                        <button
                          className="action-icon delete"
                          onClick={() => handleDelete(u)}
                          title="Benutzer löschen"
                        >
                          <Icons.Trash />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
