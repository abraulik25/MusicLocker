import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Moods() {
    const { user } = useAuth();
    const [moods, setMoods] = useState([]);
    const [modal, setModal] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [form, setForm] = useState({ name: '', description: '' });
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);

    const isAdmin = user?.role === 'admin';

    const load = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/moods`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setMoods(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openCreate = () => {
        setForm({ name: '', description: '' });
        setEditingId(null);
        setModal('create');
    };

    const openEdit = (mood) => {
        setForm({ name: mood.name, description: mood.description || '' });
        setEditingId(mood.moodId);
        setModal('edit');
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            alert('Name ist erforderlich');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const url = editingId
                ? `${API_BASE}/moods/${editingId}`
                : `${API_BASE}/moods`;
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(form)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Fehler beim Speichern');
            }

            await load();
            setModal(null);
            alert(editingId ? 'Mood aktualisiert ✓' : 'Mood erstellt ✓');
        } catch (e) {
            alert(e.message);
        }
    };

    const handleDelete = async (moodId) => {
        setConfirmModal({
            isOpen: true,
            title: 'Mood löschen',
            message: 'Möchtest du dieses Mood wirklich löschen?',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API_BASE}/moods/${moodId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.error || 'Fehler beim Löschen');
                    }

                    await load();
                    alert('Mood gelöscht ✓');
                } catch (e) {
                    alert(e.message);
                }
            }
        });
    };

    if (loading) return <div style={{ color: 'var(--text-lo)', marginTop: 60, textAlign: 'center' }}>Laden…</div>;

    if (!isAdmin) {
        return (
            <div className="card" style={{ marginTop: 60, textAlign: 'center' }}>
                <h2>⛔ Zugriff verweigert</h2>
                <p className="text-lo">Nur Admins können Moods verwalten</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>🎭 Moods</h1>
                    <span className="subtitle">Verwalte emotionale Stimmungen für Tracks</span>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>+ Neues Mood</button>
            </div>

            {/* Info-Bereich: Erklärung für den User */}
            <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(236,72,153,0.07))', borderColor: 'var(--accent-md)' }}>
                <div className="flex items-center gap-3">
                    <span style={{ fontSize: 28 }}>💡</span>
                    <div>
                        <div style={{ fontWeight: 700, marginBottom: 3 }}>Mood-basierte Empfehlungen</div>
                        <div className="text-sm text-md">
                            Moods werden verwendet, um ähnliche Tracks zu finden. Tracks mit gemeinsamen Moods werden automatisch als ähnlich erkannt.
                        </div>
                    </div>
                </div>
            </div>

            {/* Statistik: Anzahl der Moods */}
            <div className="flex gap-3 items-center" style={{ marginBottom: 14 }}>
                <span className="info-badge">📊 {moods.length} Moods insgesamt</span>
            </div>

            {/* Tabelle der Moods */}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Beschreibung</th>
                            <th>Erstellt</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {moods.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-lo)' }}>
                                    Keine Moods vorhanden
                                </td>
                            </tr>
                        ) : (
                            moods.map(mood => (
                                <tr key={mood.moodId}>
                                    <td><span className="tag tag-pink">{mood.moodId}</span></td>
                                    <td style={{ fontWeight: 600 }}>{mood.name}</td>
                                    <td style={{ color: 'var(--text-md)' }}>{mood.description || '—'}</td>
                                    <td className="text-sm text-lo">
                                        {new Date(mood.createdAt).toLocaleDateString('de-DE')}
                                    </td>
                                    <td>
                                        <div className="flex gap-2 justify-end">
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(mood)}>
                                                ✏️ Bearbeiten
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(mood.moodId)}>
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modal === 'create' ? 'Neues Mood' : 'Mood bearbeiten'}</h2>
                            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <label className="label">Name *</label>
                                <input
                                    className="input"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="z.B. Happy, Melancholic, Energetic"
                                />
                            </div>
                            <div className="form-row">
                                <label className="label">Beschreibung (optional)</label>
                                <textarea
                                    className="input"
                                    rows="3"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Kurze Beschreibung des Moods"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModal(null)}>Abbrechen</button>
                            <button className="btn btn-primary" onClick={handleSubmit}>
                                {modal === 'create' ? 'Erstellen' : 'Speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Confirmation Modal */}
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
