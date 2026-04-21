import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'darkoath_admin_token';

const wrap = {
  minHeight: '100vh',
  background: 'radial-gradient(ellipse at top, #2a1a0d 0%, #140a04 60%, #0a0502 100%)',
  color: '#e8d9a8',
  fontFamily: "'Cinzel', 'Georgia', serif",
  padding: '2rem 1rem',
};

const card = {
  background: 'rgba(20, 14, 8, 0.7)',
  border: '1px solid rgba(199, 168, 105, 0.35)',
  borderRadius: 8,
  padding: '1.5rem',
  boxShadow: '0 0 20px rgba(0,0,0,0.5), inset 0 0 12px rgba(199, 168, 105, 0.05)',
};

const title = {
  fontSize: '1.8rem',
  letterSpacing: '0.15em',
  color: '#c7a869',
  textAlign: 'center',
  marginBottom: '0.5rem',
};

const subtitle = {
  fontSize: '0.85rem',
  textAlign: 'center',
  color: '#8a6d3a',
  marginBottom: '2rem',
  letterSpacing: '0.1em',
};

const input = {
  width: '100%',
  padding: '0.65rem 0.8rem',
  marginBottom: '0.8rem',
  background: 'rgba(10, 6, 2, 0.7)',
  border: '1px solid rgba(199, 168, 105, 0.3)',
  borderRadius: 4,
  color: '#e8d9a8',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
};

const button = (variant = 'primary') => ({
  width: '100%',
  padding: '0.7rem 1rem',
  background:
    variant === 'danger' ? 'rgba(127, 29, 29, 0.5)' : 'rgba(120, 53, 15, 0.6)',
  color: variant === 'danger' ? '#fecaca' : '#e8d9a8',
  border: `1px solid ${variant === 'danger' ? '#dc2626' : '#c7a869'}`,
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontSize: '0.85rem',
  transition: 'all 0.2s',
});

const StatCard = ({ label, value, icon }) => (
  <div style={{ ...card, textAlign: 'center' }}>
    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
    <div
      style={{
        fontSize: '0.75rem',
        letterSpacing: '0.18em',
        color: '#8a6d3a',
        textTransform: 'uppercase',
        marginBottom: '0.5rem',
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: '2.8rem', fontWeight: 700, color: '#e8d9a8' }}>
      {value ?? '—'}
    </div>
  </div>
);

const LoginForm = ({ onAuth }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await axios.post(`${API}/admin/login`, { username, password });
      localStorage.setItem(TOKEN_KEY, res.data.token);
      onAuth(res.data.token);
    } catch (err) {
      setError(err.response?.data?.detail || 'Échec de la connexion');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: '4rem auto 0' }}>
      <div style={title}>⚜ DARK OATH ⚜</div>
      <div style={subtitle}>Salle du Conseil — Accès privé</div>
      <form onSubmit={submit} style={card}>
        <label style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: '#8a6d3a' }}>
          Identifiant
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={input}
          autoFocus
          autoComplete="username"
        />
        <label style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: '#8a6d3a' }}>
          Mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
          autoComplete="current-password"
        />
        {error && (
          <div
            style={{
              background: 'rgba(127, 29, 29, 0.4)',
              border: '1px solid #dc2626',
              color: '#fecaca',
              padding: '0.5rem',
              borderRadius: 4,
              fontSize: '0.8rem',
              marginBottom: '0.8rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}
        <button type="submit" style={button('primary')} disabled={busy}>
          {busy ? 'Vérification…' : 'Entrer'}
        </button>
      </form>
    </div>
  );
};

const Dashboard = ({ token, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
      setError('');
    } catch (err) {
      if (err.response?.status === 401) {
        onLogout();
      } else {
        setError('Impossible de charger les statistiques.');
      }
    }
  }, [token, onLogout]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const resetStats = async () => {
    if (!window.confirm('Réinitialiser toutes les statistiques ? Cette action est irréversible.'))
      return;
    setResetting(true);
    try {
      const res = await axios.post(
        `${API}/admin/stats/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(res.data);
    } catch (err) {
      setError('Échec de la réinitialisation.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ ...title, textAlign: 'left', marginBottom: 0 }}>Dashboard</div>
          <div
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.15em',
              color: '#8a6d3a',
              textTransform: 'uppercase',
            }}
          >
            Dark Oath · Statistiques
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{ ...button('primary'), width: 'auto', padding: '0.5rem 1rem' }}
        >
          Déconnexion
        </button>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(127, 29, 29, 0.4)',
            border: '1px solid #dc2626',
            color: '#fecaca',
            padding: '0.6rem',
            borderRadius: 4,
            marginBottom: '1.5rem',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <StatCard label="Visites du site" value={stats?.visits} icon="🕯️" />
        <StatCard label="Parties jouées" value={stats?.games_played} icon="⚔️" />
      </div>

      <div style={{ maxWidth: 320, margin: '0 auto' }}>
        <button onClick={resetStats} style={button('danger')} disabled={resetting}>
          {resetting ? 'Réinitialisation…' : '⟳ Réinitialiser les statistiques'}
        </button>
      </div>
    </div>
  );
};

const DashAdmin = () => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <div style={wrap}>
      {token ? (
        <Dashboard token={token} onLogout={logout} />
      ) : (
        <LoginForm onAuth={setToken} />
      )}
    </div>
  );
};

export default DashAdmin;
