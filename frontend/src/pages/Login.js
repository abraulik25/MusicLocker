import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import '../App.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login fehlgeschlagen');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <span className="logo-icon">♫</span>
                    <div className="logo-text-wrap">
                        <span className="logo-text">Music Locker</span>
                        <span className="logo-subtitle">Musikempfehlungs-System</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-row">
                        <label className="label" htmlFor="email">Email</label>
                        <input
                            className="input"
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@musiclocker.com"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-row">
                        <label className="label" htmlFor="password">Passwort</label>
                        <input
                            className="input"
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Anmelden...' : 'Anmelden'}
                    </button>
                </form>

                <div className="auth-link">
                    <div className="text-sm text-lo mb-4">
                        Standard-Login: <code>admin@melodygraph.com</code> / <code>admin123</code><br />
                        Oder: <code>anna@example.com</code> / <code>password123</code>
                    </div>
                    <p className="text-sm text-md">
                        Noch kein Account? <Link to="/register">Jetzt registrieren</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
