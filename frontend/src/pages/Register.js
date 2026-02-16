import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import '../App.css';

const MOODS = [
    'Happy', 'Sad', 'Energetic', 'Calm', 'Romantic',
    'Melancholic', 'Uplifting', 'Dark', 'Chill', 'Intense',
    'Dreamy', 'Aggressive', 'Peaceful', 'Nostalgic', 'Mysterious', 'Epic', 'Groovy', 'Powerful', 'Atmospheric', 'Technical',
    'Rebellious', 'Catchy', 'Sunny', 'Classic', 'Dramatic'
];

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedMoods, setSelectedMoods] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const toggleMood = (mood) => {
        if (selectedMoods.includes(mood)) {
            setSelectedMoods(selectedMoods.filter(m => m !== mood));
        } else {
            if (selectedMoods.length < 3) {
                setSelectedMoods([...selectedMoods, mood]);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validierung: Stimmen die Passwörter überein?
        if (password !== confirmPassword) {
            setError('Passwörter stimmen nicht überein');
            return;
        }

        // Validierung: Ist das Passwort lang genug?
        if (password.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein');
            return;
        }

        // Validierung: Ist es eine echte Email-Adresse?
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Ungültiges Email-Format');
            return;
        }

        // Validierung: Name vorhanden?
        if (name.length < 2) {
            setError('Name muss mindestens 2 Zeichen lang sein');
            return;
        }

        // Validierung: Wurden genau 3 Moods gewählt?
        if (selectedMoods.length !== 3) {
            setError('Bitte wähle genau 3 Moods für bessere Empfehlungen');
            return;
        }

        setLoading(true);

        try {
            await register({ name, email, password, preferredMoods: selectedMoods });
            navigate('/');
        } catch (err) {
            setError(err.message || 'Registrierung fehlgeschlagen');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card" style={{ maxWidth: 520 }}>
                <div className="auth-logo">
                    <span className="logo-icon">♫</span>
                    <div className="logo-text-wrap">
                        <span className="logo-text">Music Locker</span>
                        <span className="logo-subtitle">Neuen Account erstellen</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-row">
                        <label className="label" htmlFor="name">Name</label>
                        <input
                            className="input"
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Max Mustermann"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-row">
                        <label className="label" htmlFor="email">Email</label>
                        <input
                            className="input"
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="max@example.com"
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-row">
                            <label className="label" htmlFor="password">Passwort</label>
                            <input
                                className="input"
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 6 Zeichen"
                                required
                            />
                        </div>

                        <div className="form-row">
                            <label className="label" htmlFor="confirmPassword">Bestätigen</label>
                            <input
                                className="input"
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Wiederholen"
                                required
                            />
                        </div>
                    </div>

                    {/* Mood-Wahl */}
                    <div className="form-row">
                        <label className="label">
                            Wähle 3 Moods für erste Empfehlungen
                            <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
                                ({selectedMoods.length}/3)
                            </span>
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                            marginTop: 8
                        }}>
                            {MOODS.map(mood => (
                                <button
                                    key={mood}
                                    type="button"
                                    onClick={() => toggleMood(mood)}
                                    className={`mood-option ${selectedMoods.includes(mood) ? 'selected' : ''}`}
                                >
                                    {mood}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <div className="error-message">⚠️ {error}</div>}

                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: 24 }}>
                        {loading ? 'Registrierung läuft...' : 'Registrieren'}
                    </button>
                </form>
                <div className="auth-link">
                    <Link to="/login">Bereits registriert? Jetzt anmelden</Link>
                </div>
            </div>
        </div>
    );
}
