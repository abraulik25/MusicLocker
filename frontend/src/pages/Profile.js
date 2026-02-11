import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { mongoApi } from '../api';

export default function Profile() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState(user?.name || '');
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const handleUpdate = async () => {
        try {
            setError('');
            setSuccess('');
            const updatedUser = { ...user, name };
            login(updatedUser, localStorage.getItem('token'));
            setSuccess('Profil erfolgreich aktualisiert!');
        } catch (e) {
            setError('Fehler beim Aktualisieren: ' + e.message);
        }
    };

    return (
        <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
            <button
                onClick={() => navigate(-1)}
                className="btn"
                style={{ background: 'transparent', color: 'var(--text-lo)', marginBottom: 20, padding: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
                <span>←</span> Zurück
            </button>

            <div className="page-header text-center mb-10">
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Mein Profil</h1>
                <span className="subtitle" style={{ fontSize: '1.1rem', opacity: 0.7 }}>Verwalte deine Kontoinformationen</span>
            </div>

            <div className="glass-card" style={{ padding: '40px', borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex flex-col items-center mb-10">
                    <div className="profile-avatar-lg" style={{ width: 120, height: 120, marginBottom: 20 }}>
                        <div className="profile-initials" style={{ fontSize: 48 }}>
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{user?.name}</h2>
                    <span className="badge" style={{ background: 'var(--accent)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {user?.role === 'admin' ? 'ADMIN' : 'USER'}
                    </span>
                    <p className="text-lo mt-4">{user?.email}</p>
                </div>

                <div className="form-group mb-8">
                    <label className="form-label block mb-2 font-bold text-lo">Anzeigename</label>
                    <div className="flex gap-4">
                        <input
                            className="form-input flex-1"
                            style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Dein Name"
                        />
                        <button className="btn" style={{ background: 'var(--accent)', color: 'white', padding: '0 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }} onClick={handleUpdate}>
                            Speichern
                        </button>
                    </div>
                </div>

                {success && <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '24px', textAlign: 'center' }}>{success}</div>}
                {error && <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '24px', textAlign: 'center' }}>{error}</div>}

            </div>
        </div>
    );
}
