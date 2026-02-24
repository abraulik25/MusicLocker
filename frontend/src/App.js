import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, Link } from 'react-router-dom';

import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Artists from './pages/Artists';
import Albums from './pages/Albums';
import Tracks from './pages/Tracks';
import Playlists from './pages/Playlists';
import Moods from './pages/Moods';
import Neo4jView from './pages/Neo4jView';


import './App.css';

function Sidebar() {
  const { user } = useAuth();

  const links = [
    { to: '/', label: 'Dashboard', icon: '⬡' },
    { to: '/users', label: 'User', icon: '👥' },
    { to: '/artists', label: 'Künstler', icon: '🎤' },
    { to: '/tracks', label: 'Lieder', icon: '🎵' },
    { to: '/albums', label: 'Alben', icon: '💿' },
    { to: '/playlists', label: 'Playlists', icon: '📋' },
    { to: '/moods', label: 'Moods', icon: '🎭' },
    { to: '/neo4j', label: 'Netzwerk', icon: '🔗' },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <img src="/favicon.png" alt="Music Locker Logo" className="logo-image" />
        <div className="logo-text-wrap">
          <span className="logo-text">Music Locker</span>
          <span className="logo-subtitle">Dein Musik-Netzwerk</span>
        </div>
      </div>
      <ul className="sidebar-nav">
        {links.filter(l => l.to !== '/moods' || user?.role === 'admin').map(l => (
          <li key={l.to}>
            <NavLink to={l.to} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      {/* Sidebar Footer (Infos über den eingeloggten User) */}
      <div className="sidebar-footer">
        {user && (
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role text-sm">{user.role}</div>
          </div>
        )}
      </div>
    </nav>
  );
}

function TopBar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="top-bar">
      <div className="profile-menu" ref={dropdownRef}>
        <div className="profile-menu-trigger" onClick={() => setOpen(!open)}>
          <div className={`avatar-btn ${open ? 'active' : ''}`}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>

        {open && (
          <div className="menu-dropdown">
            <Link to="/profile" className="menu-item highlight" onClick={() => setOpen(false)}>
              👤 Profil bearbeiten
            </Link>
            <div className="menu-divider"></div>
            <div className="menu-item danger" onClick={() => { setOpen(false); logout(); }}>
              🚪 Abmelden
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Diese Komponente schützt Seiten: Nur eingeloggte User dürfen sie sehen!
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Laden...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading">Laden...</div>;

  // TopBar (Profil-Menü) überall anzeigen, außer auf der Graph-Seite (/neo4j)
  const showTopBar = location.pathname !== '/neo4j';

  return (
    <div className="app-layout">
      {user && <Sidebar />}
      <main className="main-content" style={{ position: 'relative' }}>
        {user && showTopBar && <TopBar />}
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/artists" element={<ProtectedRoute><Artists /></ProtectedRoute>} />
          <Route path="/albums" element={<ProtectedRoute><Albums /></ProtectedRoute>} />
          <Route path="/tracks" element={<ProtectedRoute><Tracks /></ProtectedRoute>} />
          <Route path="/playlists" element={<ProtectedRoute><Playlists /></ProtectedRoute>} />
          <Route path="/moods" element={<ProtectedRoute><Moods /></ProtectedRoute>} />
          <Route path="/neo4j" element={<ProtectedRoute><Neo4jView /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}
