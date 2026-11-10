import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Crown, Sword, Shield, Users, Globe, Music, Volume2, VolumeX, BookOpen } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { useTranslation } from 'react-i18next';
import './i18n';
import './styles/medieval.css';
import axios from 'axios';
import GameInterface from './components/GameInterface';
import DashAdmin from './components/DashAdmin';
import Tutorial, { tutorialDone, TutorialPage } from './components/Tutorial';
import { Toaster, toast } from 'sonner';
import { LAST_ROOM_KEY, rememberRoom, forgetRoom, errorMessage } from './lib/game';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Shared localStorage keys so music volume is consistent across Home,
// Lobby and the in-game music control.
const MUSIC_VOLUME_KEY = 'darkoath_music_volume';
const MUSIC_ENABLED_KEY = 'darkoath_music_enabled';
// Signed JWT issued by the backend on /auth/anonymous. Attached as
// Authorization: Bearer <token> on every API call and as ?token= on
// every WebSocket URL. Previously the raw userId travelled in query
// strings, which leaked in nginx access logs and allowed any player who
// saw a URL to impersonate another player (vote for them, read their
// secret role, execute, etc.). The token fixes that class of bugs.
const AUTH_TOKEN_KEY = 'darkoath_auth_token';

// Axios interceptor: attach the Bearer token to every request aimed at
// the backend. Installed once at module load; components keep calling
// axios as before without knowing about the token.
//
// Important: do NOT overwrite an Authorization header that the caller
// has already set explicitly (e.g. the admin dashboard uses its own
// admin token, which is a different identity from the player JWT).
axios.interceptors.request.use((config) => {
  try {
    if (typeof config.url !== 'string' || !config.url.startsWith(BACKEND_URL)) {
      return config;
    }
    config.headers = config.headers || {};
    // Respect a manually-set Authorization header (admin token, etc.).
    const existing =
      config.headers.Authorization ||
      config.headers.authorization ||
      (typeof config.headers.get === 'function' && config.headers.get('Authorization'));
    if (existing) return config;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {
    // localStorage disabled — proceed without auth, the request will just 401.
  }
  return config;
});

// Helper used by WebSocket URLs (browsers cannot set headers on WS).
export const getAuthToken = () => {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || ''; } catch { return ''; }
};

const readVolume = (fallback = 0.3) => {
  const saved = localStorage.getItem(MUSIC_VOLUME_KEY);
  if (saved === null) return fallback;
  const v = parseFloat(saved);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
};
const readEnabled = (fallback = true) => {
  const saved = localStorage.getItem(MUSIC_ENABLED_KEY);
  if (saved === null) return fallback;
  return saved === 'true';
};

// Compact music widget: toggle + expandable volume slider.
// Mirrors the style used inside GameInterface so the look stays consistent.
const MusicControl = ({ enabled, volume, onToggle, onVolume }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-full"
      style={{
        background: 'rgba(20, 14, 8, 0.7)',
        border: '1px solid rgba(199, 168, 105, 0.4)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center rounded-full transition-colors"
        style={{ width: 28, height: 28, color: enabled ? '#e8d9a8' : '#8a6d3a' }}
        title={enabled ? 'Couper la musique' : 'Activer la musique'}
        aria-label={enabled ? 'Couper la musique' : 'Activer la musique'}
      >
        {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] uppercase tracking-widest opacity-70 hover:opacity-100"
        style={{ color: '#e8d9a8', fontFamily: "'Lora', Georgia, serif" }}
        aria-label="Régler le volume"
      >
        Musique
      </button>
      {expanded && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
          className="w-20 accent-amber-500"
          aria-label="Volume de la musique"
        />
      )}
    </div>
  );
};

// Landing Page Component with Dark Medieval Design
const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState(() => {
    try { return localStorage.getItem('playerName') || ''; } catch { return ''; }
  });
  // Invitation links land here as /?join=CODE
  const [roomCode, setRoomCode] = useState(() => {
    try {
      return (new URLSearchParams(window.location.search).get('join') || '').toUpperCase().slice(0, 6);
    } catch { return ''; }
  });
  const [lastRoom] = useState(() => {
    try { return localStorage.getItem(LAST_ROOM_KEY) || ''; } catch { return ''; }
  });
  const [busy, setBusy] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(() => readEnabled(true));
  const [musicVolume, setMusicVolume] = useState(() => readVolume(0.3));
  const [showRules, setShowRules] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('regles') === '1'; } catch { return false; }
  });
  const location = useLocation();
  const [tutoDone] = useState(() => tutorialDone());
  // Ancien lien ?tuto=1 → page dédiée ; retour du tutoriel → curseur sur le nom.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('tuto') === '1') {
        navigate('/tutoriel', { replace: true });
        return;
      }
    } catch {}
    if (location.state?.focusName) {
      setTimeout(() => document.getElementById('player-name')?.focus(), 50);
      navigate('/', { replace: true, state: null });
    }
  }, []);
  const audioRef = useRef(null);

  // Track a site visit once per session
  useEffect(() => {
    if (sessionStorage.getItem('darkoath_visit_tracked') === '1') return;
    axios.post(`${API}/track/visit`).then(() => {
      sessionStorage.setItem('darkoath_visit_tracked', '1');
    }).catch(() => {});
  }, []);

  // Medieval music control - Auto-play by default (Morceau 3).
  // Mount-once: the audio element survives toggles; volume/enable effects
  // below drive its state without tearing it down.
  useEffect(() => {
    const audio = new Audio('/music/morceau3.mp3');
    audio.loop = true;
    audio.volume = readVolume(0.3);
    // iOS Safari: required so the audio plays inline instead of fullscreen
    // and cooperates with autoplay/gesture rules.
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.preload = 'auto';
    audioRef.current = audio;

    let started = false;

    const tryPlay = () => {
      if (started) return;
      if (!readEnabled(true)) return;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { started = true; }).catch(() => {
          // Autoplay blocked on iOS — will retry on first user gesture.
        });
      } else {
        started = true;
      }
    };

    // Attempt immediate play (works on desktop, typically blocked on iOS).
    tryPlay();

    // iOS: on the first user gesture anywhere, retry if not yet playing.
    const onGesture = () => {
      tryPlay();
      if (started) {
        document.removeEventListener('touchend', onGesture, true);
        document.removeEventListener('click', onGesture, true);
        document.removeEventListener('keydown', onGesture, true);
      }
    };
    document.addEventListener('touchend', onGesture, true);
    document.addEventListener('click', onGesture, true);
    document.addEventListener('keydown', onGesture, true);

    return () => {
      try { audio.pause(); } catch {}
      document.removeEventListener('touchend', onGesture, true);
      document.removeEventListener('click', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
      audioRef.current = null;
    };
  }, []);

  // Live-update volume + persist preference
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
    localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume));
  }, [musicVolume]);

  // Live-update enabled state + persist preference
  useEffect(() => {
    const el = audioRef.current;
    localStorage.setItem(MUSIC_ENABLED_KEY, String(musicEnabled));
    if (!el) return;
    if (musicEnabled) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      try { el.pause(); } catch {}
    }
  }, [musicEnabled]);

  // Authenticate + persist token. Called at the top of createRoom/joinRoom so
  // the axios interceptor can attach the Bearer token to every subsequent
  // request. Display name now travels in the JSON body instead of the query
  // string so it doesn't leak into access logs.
  const authenticate = async (name) => {
    const res = await axios.post(`${API}/auth/anonymous`, { name });
    const { userId, token, name: canonicalName } = res.data;
    localStorage.setItem('userId', userId);
    localStorage.setItem('playerName', canonicalName || name);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return { userId, token };
  };

  // Reuse the existing identity when the name hasn't changed, so a player who
  // comes back keeps their seat (a new token = a new player id).
  const ensureAuth = async (name) => {
    let sameName = false;
    let hasToken = false;
    try {
      sameName = (localStorage.getItem('playerName') || '') === name;
      hasToken = !!localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {}
    if (sameName && hasToken) return;
    await authenticate(name);
  };

  // Run a request; on 401 (expired token) re-authenticate once and retry.
  const withAuth = async (name, fn) => {
    await ensureAuth(name);
    try {
      return await fn();
    } catch (error) {
      if (error?.response?.status !== 401) throw error;
      await authenticate(name);
      return fn();
    }
  };

  const createRoom = async () => {
    if (!playerName.trim() || busy) return;
    setBusy(true);
    try {
      const roomResponse = await withAuth(playerName.trim(), () => axios.post(`${API}/rooms`));
      const { code } = roomResponse.data;
      navigate(`/lobby/${code}`);
    } catch (error) {
      toast.error(errorMessage(error, "Impossible de créer la salle."));
    } finally {
      setBusy(false);
    }
  };

  // One click to a real game: a private table filled with bots, already started.
  const quickPlay = async () => {
    if (!playerName.trim() || busy) return;
    setBusy(true);
    try {
      const roomResponse = await withAuth(playerName.trim(), () => axios.post(`${API}/rooms`));
      const { code } = roomResponse.data;
      await axios.post(`${API}/rooms/${code}/join`);
      for (let i = 0; i < 5; i += 1) {
        await axios.post(`${API}/rooms/${code}/action`, { action_type: 'ADD_BOT', payload: {} });
      }
      await axios.post(`${API}/rooms/${code}/start`);
      navigate(`/game/${code}`);
    } catch (error) {
      toast.error(errorMessage(error, "Impossible de lancer la partie rapide."));
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (codeOverride) => {
    const code = (typeof codeOverride === 'string' ? codeOverride : roomCode).trim().toUpperCase();
    if (!playerName.trim() || !code || busy) return;
    setBusy(true);
    try {
      const room = await withAuth(playerName.trim(), () => axios.get(`${API}/rooms/${code}`));
      const me = localStorage.getItem('userId');
      const inRoom = (room.data.players || []).some((p) => p.id === me);
      if (room.data.status !== 'lobby' && inRoom) {
        navigate(`/game/${code}`);
      } else {
        navigate(`/lobby/${code}`);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Salle introuvable. Vérifiez le code.'));
    } finally {
      setBusy(false);
    }
  };

  if (showRules) {
    const rulesEmbers = Array.from({ length: 20 }, (_, i) => ({
      left: `${(i * 5.1) % 100}%`,
      delay: `${(i * 0.83) % 8}s`,
      duration: `${9 + ((i * 1.17) % 6)}s`,
      size: 2 + (i % 3),
    }));

    return (
      <div className="darkoath-landing">
        {rulesEmbers.map((e, i) => (
          <span
            key={i}
            className="ember"
            style={{
              left: e.left,
              animationDelay: e.delay,
              animationDuration: e.duration,
              width: `${e.size}px`,
              height: `${e.size}px`,
            }}
          />
        ))}

        <div className="relative z-10 min-h-screen p-6 py-12">
          <div className="max-w-4xl mx-auto">

            {/* Header */}
            <div className="flex justify-between items-center mb-10">
              <Button
                onClick={() => setShowRules(false)}
                variant="outline"
                size="sm"
                className="border-amber-700/60 text-amber-300 hover:bg-amber-900/30 bg-black/40 backdrop-blur-sm"
              >
                ← Retour
              </Button>
              <div className="darkoath-subtitle text-xs md:text-sm uppercase">
                ✦ Le Codex ✦
              </div>
              <div className="w-20" />
            </div>

            {/* Hero */}
            <div className="text-center mb-12">
              <h1 className="darkoath-title text-4xl md:text-6xl mb-3">
                LES RÈGLES DU SERMENT
              </h1>
              <p className="darkoath-tagline text-lg md:text-xl italic">
                Que nul ne franchisse le seuil sans connaître le pacte.
              </p>
            </div>

            <div className="space-y-8">

              {/* Objectif */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  🎯 &nbsp;Le Jeu en un Coup d'Œil
                </h3>
                <p className="text-amber-100/90 leading-relaxed mb-3" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  Dark Oath est un jeu de <strong>déduction sociale</strong> pour <strong>5 à 10 joueurs</strong>. Deux camps s'affrontent en secret&nbsp;: les <strong className="text-blue-300">Fidèles</strong> défendent la Couronne, les <strong className="text-red-400">Traîtres</strong> et leur <strong className="text-purple-300">Tyran</strong> la font tomber.
                </p>
                <p className="text-amber-100/85 leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  À chaque tour, un <strong>Roi</strong> choisit un <strong>Conseiller</strong>, la table vote pour les approuver, puis ils adoptent un décret. Les décrets remplissent deux pistes&nbsp;: l'une mène à la victoire des Fidèles, l'autre à celle des Traîtres. Mentir, démasquer, manipuler&nbsp;: tout est permis.
                </p>
              </section>

              {/* Rôles — SECTION PRIORITAIRE */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-5" style={{ fontSize: '1.6rem' }}>
                  🎭 &nbsp;Les Rôles
                </h3>
                <p className="text-amber-100/80 text-sm italic mb-5" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  Votre rôle est <strong>secret</strong>. Il vous est révélé au début de la partie et ne change jamais.
                </p>
                <div className="space-y-4">
                  <div className="role-card role-card--fidele p-5">
                    <h4 className="font-bold text-blue-300 mb-2 text-lg" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.1em' }}>🛡️ FIDÈLE</h4>
                    <p className="text-sm text-amber-100/90 mb-2 leading-relaxed"><strong>But&nbsp;:</strong> protéger la Couronne en adoptant 5 Décrets Loyaux, ou en tuant le Tyran (Exécution ou Flèche du Peuple).</p>
                    <p className="text-sm text-amber-100/75 leading-relaxed"><strong>Ce que vous savez&nbsp;:</strong> uniquement votre propre rôle. Vous devez déduire qui sont les Traîtres à travers les votes, les décrets et les discussions.</p>
                  </div>
                  <div className="role-card role-card--traitre p-5">
                    <h4 className="font-bold text-red-300 mb-2 text-lg" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.1em' }}>⚔️ TRAÎTRE</h4>
                    <p className="text-sm text-amber-100/90 mb-2 leading-relaxed"><strong>But&nbsp;:</strong> saboter la Couronne en adoptant 6 Décrets de Trahison, ou en faisant élire le Tyran au poste de Conseiller après 3+ Décrets de Trahison.</p>
                    <p className="text-sm text-amber-100/75 leading-relaxed"><strong>Ce que vous savez&nbsp;:</strong> l'identité des autres Traîtres <strong>et</strong> du Tyran. Votre mission&nbsp;: <strong>protéger le Tyran</strong> pour qu'il ne soit jamais démasqué ni tué, semer le doute, et assassiner un Fidèle lors du Complot.</p>
                  </div>
                  <div className="role-card role-card--tyran p-5">
                    <h4 className="font-bold text-purple-300 mb-2 text-lg" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.1em' }}>👑 TYRAN</h4>
                    <p className="text-sm text-amber-100/90 mb-2 leading-relaxed"><strong>But&nbsp;:</strong> être élu Conseiller après que 3 Décrets de Trahison ont été adoptés (victoire immédiate avec les Traîtres).</p>
                    <p className="text-sm text-amber-100/75 leading-relaxed"><strong>Ce que vous savez&nbsp;:</strong>
                      {' '}<strong>rien</strong>, quel que soit le nombre de joueurs&nbsp;: les Traîtres savent qui vous êtes, mais vous ne savez pas qui ils sont. À eux de vous protéger et de vous faire élire Conseiller. Si la table vous démasque, vous mourez&nbsp;: agissez comme un Fidèle jusqu'au bon moment.
                    </p>
                  </div>
                </div>
              </section>

              {/* Composition */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-5" style={{ fontSize: '1.6rem' }}>
                  👥 &nbsp;Répartition des Rôles
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ color: '#e8d9a8' }}>
                    <thead>
                      <tr className="text-left border-b" style={{ borderColor: 'rgba(199, 168, 105, 0.3)', fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>
                        <th className="py-2 pr-3">Joueurs</th>
                        <th className="py-2 pr-3 text-blue-300">Fidèles</th>
                        <th className="py-2 pr-3 text-red-300">Traîtres</th>
                        <th className="py-2 text-purple-300">Tyran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [5, 3, 1, 1], [6, 4, 1, 1], [7, 4, 2, 1],
                        [8, 5, 2, 1], [9, 5, 3, 1], [10, 6, 3, 1],
                      ].map(([n, f, t, u]) => (
                        <tr key={n} className="border-b" style={{ borderColor: 'rgba(199, 168, 105, 0.1)' }}>
                          <td className="py-2 pr-3 font-bold">{n}</td>
                          <td className="py-2 pr-3 text-blue-200">{f}</td>
                          <td className="py-2 pr-3 text-red-200">{t}</td>
                          <td className="py-2 text-purple-200">{u}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Tour */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-5" style={{ fontSize: '1.6rem' }}>
                  🎮 &nbsp;Déroulement d'un Tour
                </h3>
                <div className="space-y-3">
                  {[
                    { num: '1', title: 'Nomination', text: "Le Roi (à tour de rôle autour de la table) propose un Conseiller. Ne peuvent pas être nommés : le dernier Conseiller élu, et le dernier Roi élu (sauf s'il ne reste que 5 joueurs en vie)." },
                    { num: '2', title: 'Vote', text: "Tous les joueurs vivants votent OUI ou NON à la majorité simple, sauf le Roi et le Conseiller proposé, qui ne votent pas. Les votes restent secrets jusqu'au dernier bulletin, puis sont révélés à tous. Si OUI, le gouvernement est formé. Si NON ou égalité, la couronne passe au joueur suivant et la Piste de Crise avance d'une case. Après 3 Trahisons, élire le Tyran Conseiller fait gagner les Traîtres." },
                    { num: '3', title: 'Législation — le Roi', text: "Le Roi pioche 3 décrets, en défausse 1 secrètement, et transmet les 2 restants au Conseiller." },
                    { num: '4', title: 'Législation — le Conseiller', text: "Le Conseiller défausse 1 décret en secret et révèle le dernier. Ce décret est appliqué et avance la piste correspondante (Fidèles ou Trahison)." },
                    { num: '5', title: 'Conseil du Royaume', text: "Après chaque décret révélé, jusqu'à 60 secondes de discussion (vocal et chat). Le Conseil se termine plus tôt si tous les joueurs cliquent « Prêt »." },
                    { num: '6', title: 'Pouvoir du Roi (si déclenché)', text: "Certaines cases de la piste Trahison donnent un pouvoir au Roi qui vient de l'adopter : Enquête, Regard sur la pioche, Élection spéciale ou Exécution, selon le nombre de joueurs (voir Pouvoirs du Roi). Le Roi doit l'utiliser." },
                    { num: '7', title: 'Pouvoirs de camp (Complot & Flèche)', text: "Au 2e Décret de Trahison, les Traîtres assassinent en secret un Fidèle (le Complot). Au 3e Décret Loyal, toute la table tire la Flèche du Peuple sur celui qu'elle croit être le Tyran. Chaque pouvoir ne sert qu'une fois par partie (voir Pouvoirs de camp)." },
                    { num: '8', title: 'Veto (après 5 Trahisons)', text: "Le Conseiller peut demander le veto des deux décrets reçus. Si le Roi accepte, les deux sont défaussés et la Piste de Crise avance. S'il refuse, le Conseiller doit en adopter un." },
                  ].map((step) => (
                    <div key={step.num} className="flex gap-4 items-start p-4 rounded-lg" style={{
                      background: 'linear-gradient(180deg, rgba(30, 20, 12, 0.6), rgba(18, 12, 8, 0.7))',
                      border: '1px solid rgba(199, 168, 105, 0.2)',
                    }}>
                      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-amber-200 font-bold" style={{
                        background: 'radial-gradient(circle, rgba(199, 168, 105, 0.25), rgba(90, 60, 20, 0.4))',
                        border: '1px solid rgba(199, 168, 105, 0.5)',
                        fontFamily: "'Lora', Georgia, serif",
                      }}>
                        {step.num}
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-300 mb-1" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>{step.title}</h4>
                        <p className="text-sm text-amber-100/85 leading-relaxed">{step.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Pistes & Victoire */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-5" style={{ fontSize: '1.6rem' }}>
                  🏆 &nbsp;Pistes & Conditions de Victoire
                </h3>
                <p className="text-amber-100/85 text-sm leading-relaxed mb-5" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  Chaque décret adopté avance la piste de son camp. Le premier camp à remplir sa piste gagne. D'autres conditions peuvent aussi clore la partie immédiatement.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="role-card role-card--fidele p-5">
                    <h4 className="font-bold text-blue-300 mb-2" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>🛡️ FIDÈLES gagnent si</h4>
                    <ul className="text-sm text-amber-100/85 leading-relaxed space-y-1 list-disc list-inside">
                      <li>5 Décrets Loyaux adoptés, <strong>ou</strong></li>
                      <li>le Tyran est exécuté, <strong>ou</strong></li>
                      <li>la Flèche du Peuple touche le Tyran.</li>
                    </ul>
                  </div>
                  <div className="role-card role-card--traitre p-5">
                    <h4 className="font-bold text-red-300 mb-2" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>⚔️ TRAÎTRES gagnent si</h4>
                    <ul className="text-sm text-amber-100/85 leading-relaxed space-y-1 list-disc list-inside">
                      <li>6 Décrets de Trahison adoptés, <strong>ou</strong></li>
                      <li>le Tyran est élu Conseiller après 3+ Trahison.</li>
                    </ul>
                  </div>
                  <div className="role-card role-card--tyran p-5">
                    <h4 className="font-bold text-purple-300 mb-2" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>👑 TYRAN gagne</h4>
                    <p className="text-sm text-amber-100/85 leading-relaxed">avec les Traîtres — sa victoire personnelle est d'être élu Conseiller après 3 Décrets de Trahison.</p>
                  </div>
                </div>
              </section>

              {/* Pouvoirs */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  ⚜️ &nbsp;Pouvoirs du Roi
                </h3>
                <p className="text-amber-100/85 text-sm leading-relaxed mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  Quand un gouvernement élu adopte un Décret de Trahison sur une case marquée, le Roi doit utiliser le pouvoir de cette case. Les cases dépendent du <strong>nombre de joueurs</strong>. Un décret imposé par la Colère du Peuple ne donne <strong>aucun</strong> pouvoir.
                </p>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm" style={{ color: '#e8d9a8' }}>
                    <thead>
                      <tr className="text-left border-b" style={{ borderColor: 'rgba(199, 168, 105, 0.3)', fontFamily: "'Lora', Georgia, serif" }}>
                        <th className="py-2 pr-2">Joueurs</th>
                        {[1, 2, 3, 4, 5].map((n) => <th key={n} className="py-2 pr-2 text-red-300">{n}<sup>e</sup></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['5-6', '—', '—', '👁️', '🪓', '🪓'],
                        ['7-8', '—', '🔍', '🗳️', '🪓', '🪓'],
                        ['9-10', '🔍', '🔍', '🗳️', '🪓', '🪓'],
                      ].map(([n, ...cells]) => (
                        <tr key={n} className="border-b" style={{ borderColor: 'rgba(199, 168, 105, 0.1)' }}>
                          <td className="py-2 pr-2 font-bold">{n}</td>
                          {cells.map((c, k) => <td key={k} className="py-2 pr-2">{c}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-2 text-sm text-amber-100/85">
                  <li><strong>🗡️ Complot (2<sup>e</sup> Trahison, toutes tailles de table)&nbsp;:</strong> voir Pouvoirs de camp ci-dessous. Il s'ajoute au pouvoir du Roi s'il y en a un.</li>
                  <li><strong>🔍 Enquête&nbsp;:</strong> le Roi voit en secret le camp d'un joueur (le Tyran apparaît Traître). Personne ne peut être sondé deux fois.</li>
                  <li><strong>👁️ Regard sur la pioche&nbsp;:</strong> le Roi voit en secret les 3 prochains décrets.</li>
                  <li><strong>🗳️ Élection spéciale&nbsp;:</strong> le Roi choisit le prochain Roi. Ensuite, la couronne reprend son ordre normal.</li>
                  <li><strong>🪓 Exécution&nbsp;:</strong> le Roi élimine un joueur. Si c'était le Tyran, les Fidèles gagnent.</li>
                  <li><strong>Veto&nbsp;:</strong> débloqué à partir de 5 Décrets de Trahison.</li>
                </ul>
              </section>

              {/* Pouvoirs de camp */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  🏹 &nbsp;Pouvoirs de camp
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="role-card role-card--fidele p-5">
                    <h4 className="font-bold text-blue-300 mb-2" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>🏹 LA FLÈCHE DU PEUPLE</h4>
                    <p className="text-sm text-amber-100/85 leading-relaxed">Au <strong>3<sup>e</sup> Décret Loyal</strong>, chaque joueur vivant désigne en secret celui qu'il croit être le Tyran. Le plus désigné est visé&nbsp;:</p>
                    <ul className="text-sm text-amber-100/85 leading-relaxed space-y-1 list-disc list-inside mt-1">
                      <li>c'est le Tyran&nbsp;: il meurt, <strong>les Fidèles gagnent</strong>&nbsp;;</li>
                      <li>ce n'est pas lui&nbsp;: il est <strong>innocenté</strong> publiquement («&nbsp;n'est pas le Tyran&nbsp;»)&nbsp;;</li>
                      <li>égalité&nbsp;: la flèche se perd.</li>
                    </ul>
                    <p className="text-xs text-amber-100/70 mt-2 italic">Une seule flèche par partie. Les choix de chacun sont révélés après le tir.</p>
                  </div>
                  <div className="role-card role-card--traitre p-5">
                    <h4 className="font-bold text-red-300 mb-2" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>🗡️ LE COMPLOT</h4>
                    <p className="text-sm text-amber-100/85 leading-relaxed">Au <strong>2<sup>e</sup> Décret de Trahison</strong>, la nuit tombe&nbsp;: les Traîtres choisissent en secret un <strong>Fidèle à assassiner</strong>. S'ils sont plusieurs, la majorité l'emporte.</p>
                    <p className="text-sm text-amber-100/85 leading-relaxed mt-1">Le Tyran ne participe pas (il ne connaît pas ses alliés) et ne peut pas être visé. Personne ne sait qui a frappé.</p>
                    <p className="text-xs text-amber-100/70 mt-2 italic">Une seule fois par partie, même par la Colère du Peuple.</p>
                  </div>
                </div>
              </section>

              {/* Crise */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  ⚡ &nbsp;Colère du Peuple (Piste de Crise)
                </h3>
                <p className="text-amber-100/90 leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  À chaque gouvernement rejeté, la Piste de Crise avance d'une case. Au <strong>3<sup>e</sup> rejet consécutif</strong>, le décret du dessus de la pioche est adopté <strong>automatiquement</strong>, sans pouvoir&nbsp;; les limites de mandat sont levées et la piste repart à zéro. Un gouvernement accepté remet également la piste à zéro.
                </p>
              </section>

              {/* Chat vocal */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  🕯️ &nbsp;Vocal & Chat
                </h3>
                <p className="text-amber-100/85 leading-relaxed text-sm mb-2" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  Le <strong>micro s'active pendant le Conseil du Royaume</strong>, sur simple pression. Un chat écrit est disponible à tout moment pour chuchoter, accuser ou conspirer. Les bots y annoncent leurs cartes… et mentent s'ils sont Traîtres.
                </p>
                <p className="text-amber-100/75 leading-relaxed text-sm" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  Un <strong>Conseil du Royaume</strong> de 60 secondes (ou moins si tout le monde est prêt) marque chaque révélation de décret&nbsp;: moment clé pour débattre avant le tour suivant.
                </p>
              </section>

              {/* Bots & absents */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  🤖 &nbsp;Bots & Joueurs absents
                </h3>
                <ul className="space-y-2 text-amber-100/85 text-sm" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  <li>• L'hôte de la salle peut <strong>ajouter des bots</strong> pour compléter la table : on peut jouer dès <strong>1 humain</strong>.</li>
                  <li>• Les bots jouent selon leur rôle secret : un bot Traître ment, protège le Tyran et sabote les décrets.</li>
                  <li>• Ils lisent le chat : appelez-les par leur nom pour leur demander leurs cartes, leur vote ou leurs soupçons. Accusez-les et ils se défendront. Mentez sur vos cartes et votre partenaire de gouvernement vous démasquera.</li>
                  <li>• Si un joueur n'agit pas pendant <strong>45 secondes</strong> (ou se déconnecte), le destin choisit à sa place pour que la partie ne bloque jamais.</li>
                  <li>• Quand la pioche est vide, la défausse est remélangée.</li>
                </ul>
              </section>

              {/* Conseils */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-5" style={{ fontSize: '1.6rem' }}>
                  🗡️ &nbsp;Conseils Tactiques
                </h3>
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="role-card role-card--fidele p-5">
                    <h4 className="font-bold text-blue-300 mb-3" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>POUR LES FIDÈLES</h4>
                    <ul className="text-sm space-y-2 list-disc list-inside text-amber-100/85">
                      <li>Surveillez qui vote pour quels gouvernements.</li>
                      <li>Méfiez-vous des défausses trop commodes.</li>
                      <li>Utilisez vite l'Investigation — et communiquez ce que vous apprenez.</li>
                      <li>Au 4<sup>e</sup> Décret de Trahison, exécutez — mais choisissez bien votre cible.</li>
                      <li>Avant la Flèche, mettez-vous d'accord dans le chat&nbsp;: des votes dispersés gâchent le tir.</li>
                    </ul>
                  </div>
                  <div className="role-card role-card--traitre p-5">
                    <h4 className="font-bold text-red-300 mb-3" style={{ fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>POUR LES TRAÎTRES & LE TYRAN</h4>
                    <ul className="text-sm space-y-2 list-disc list-inside text-amber-100/85">
                      <li><strong>Traîtres&nbsp;:</strong> vous connaissez l'identité du Tyran et des autres Traîtres. Protégez le Tyran sans vous trahir.</li>
                      <li>Jouez la normalité tant que votre camp ne domine pas la piste.</li>
                      <li>Accusez un Fidèle pour détourner les soupçons.</li>
                      <li>À 3 Trahison, faites élire le Tyran au poste de Conseiller.</li>
                      <li>Pendant la Flèche, détournez le tir du Tyran vers un Fidèle suspect.</li>
                      <li><strong>Tyran&nbsp;:</strong> vous ignorez qui sont vos alliés. Agissez comme un Fidèle, laissez les Traîtres vous protéger et vous porter au pouvoir.</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* TL;DR */}
              <section className="oath-card p-6 md:p-8" style={{ borderColor: 'rgba(199, 168, 105, 0.5)' }}>
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  📜 &nbsp;Résumé en 5 lignes
                </h3>
                <ol className="space-y-2 text-sm md:text-base text-amber-100/90 leading-relaxed list-decimal list-inside" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  <li>Chaque joueur reçoit un rôle secret&nbsp;: <strong className="text-blue-300">Fidèle</strong>, <strong className="text-red-300">Traître</strong>, ou <strong className="text-purple-300">Tyran</strong>.</li>
                  <li>À chaque tour, un Roi nomme un Conseiller, la table vote, puis un décret est adopté.</li>
                  <li>5 Décrets Loyaux = Fidèles gagnent. 6 Décrets de Trahison = Traîtres gagnent.</li>
                  <li>Après 3 Trahison, élire le Tyran Conseiller fait gagner le camp du Mal <strong>immédiatement</strong>.</li>
                  <li>Tuer le Tyran (Exécution ou Flèche du Peuple) fait gagner les Fidèles. Mentez, déduisez, survivez.</li>
                </ol>
              </section>

              {/* Closing quote */}
              <div className="text-center pt-4 pb-8">
                <p className="darkoath-subtitle italic text-base md:text-lg">
                  « Celui qui connaît les règles du serment le brise mieux. »
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // Deterministic ember positions — avoids re-randomizing every render
  const embers = Array.from({ length: 24 }, (_, i) => ({
    left: `${(i * 4.16) % 100}%`,
    delay: `${(i * 0.73) % 8}s`,
    duration: `${8 + ((i * 1.31) % 6)}s`,
    size: 2 + (i % 3),
  }));

  return (
    <div className="darkoath-landing">
      {/* Floating embers */}
      {embers.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={{
            left: e.left,
            animationDelay: e.delay,
            animationDuration: e.duration,
            width: `${e.size}px`,
            height: `${e.size}px`,
          }}
        />
      ))}

      {/* Music Control (toggle + volume slider) */}
      <div className="absolute top-4 right-4 z-20">
        <MusicControl
          enabled={musicEnabled}
          volume={musicVolume}
          onToggle={() => setMusicEnabled((v) => !v)}
          onVolume={setMusicVolume}
        />
      </div>

      {/* Language Toggle */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
          variant="outline"
          size="sm"
          className="border-amber-700/60 text-amber-300 hover:bg-amber-900/30 bg-black/40 backdrop-blur-sm"
        >
          <Globe className="h-4 w-4 mr-2" />
          {i18n.language.toUpperCase()}
        </Button>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 py-16">

        {/* Hero Section */}
        <div className="text-center mb-14 max-w-3xl">
          <div className="darkoath-subtitle text-sm md:text-base mb-4 uppercase">
            ✦ Un serment scellé dans l'ombre ✦
          </div>
          <h1 className="darkoath-title text-5xl md:text-8xl mb-6">
            DARK OATH
          </h1>
          <p className="darkoath-tagline text-xl md:text-2xl mb-3">
            Deux camps. Un trône. Une seule vérité.
          </p>
          <p className="darkoath-subtitle text-base md:text-lg mb-8 italic">
            Derrière chaque sourire, une lame. Derrière chaque vote, un complot.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate('/tutoriel')}
              className="oath-btn-primary px-6 py-5 text-base relative"
            >
              🎓&nbsp; Tutoriel <span className="font-normal ml-1 normal-case">· 3 min</span>
              {!tutoDone && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-300 text-black animate-pulse">
                  Nouveau ?
                </span>
              )}
            </Button>
            <Button
              onClick={() => setShowRules(true)}
              variant="outline"
              className="border-amber-700/70 text-amber-300 hover:bg-amber-950/40 bg-black/40 backdrop-blur-sm py-5"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Parchemin des Règles
            </Button>
          </div>
          {!tutoDone && (
            <p className="darkoath-subtitle text-sm mt-3 italic">Première partie ? Commencez par le tutoriel : tout est expliqué pas à pas.</p>
          )}
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-14 max-w-5xl w-full">
          <Card className="role-card role-card--fidele p-6">
            <div className="relative z-10 flex flex-col items-center text-center">
              <Shield className="h-14 w-14 text-blue-300 mb-4" strokeWidth={1.5} />
              <h3 className="darkoath-title text-2xl text-blue-200 mb-2">Fidèles</h3>
              <div className="oath-divider w-full my-3">LOYAUX</div>
              <p className="text-gray-300 text-sm leading-relaxed font-serif italic">
                Les défenseurs de la Couronne. Démasquez le Tyran avant qu'il ne soit trop tard.
              </p>
            </div>
          </Card>

          <Card className="role-card role-card--traitre p-6">
            <div className="relative z-10 flex flex-col items-center text-center">
              <Sword className="h-14 w-14 text-red-400 mb-4" strokeWidth={1.5} />
              <h3 className="darkoath-title text-2xl text-red-300 mb-2">Traîtres</h3>
              <div className="oath-divider w-full my-3">CONJURATION</div>
              <p className="text-gray-300 text-sm leading-relaxed font-serif italic">
                Vous connaissez le Tyran : protégez-le à tout prix. Semez la discorde et frappez dans la nuit.
              </p>
            </div>
          </Card>

          <Card className="role-card role-card--tyran p-6">
            <div className="relative z-10 flex flex-col items-center text-center">
              <Crown className="h-14 w-14 text-purple-300 mb-4" strokeWidth={1.5} />
              <h3 className="darkoath-title text-2xl text-purple-200 mb-2">Le Tyran</h3>
              <div className="oath-divider w-full my-3">USURPATION</div>
              <p className="text-gray-300 text-sm leading-relaxed font-serif italic">
                L'ombre derrière le trône. Seul, sans connaître ses alliés : s'il est démasqué, il meurt.
              </p>
            </div>
          </Card>
        </div>

        {/* Game Creation */}
        <Card className="oath-card w-full max-w-md">
          <CardHeader className="text-center pb-3">
            <CardTitle className="darkoath-title text-3xl text-amber-200">
              Prêter Serment
            </CardTitle>
            <CardDescription className="darkoath-subtitle italic mt-2">
              1 à 10 âmes (bots inclus) • 20 à 40 minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {lastRoom && (
              <div className="p-3 rounded border border-amber-600/50 bg-amber-950/30 flex items-center justify-between gap-3">
                <div className="text-amber-100/90 font-serif text-sm">
                  Partie en cours&nbsp;: <span className="tracking-widest text-amber-200">{lastRoom}</span>
                </div>
                <Button
                  onClick={() => joinRoom(lastRoom)}
                  disabled={!playerName.trim() || busy}
                  className="oath-btn-primary px-4 py-2 text-sm"
                >
                  Reprendre
                </Button>
              </div>
            )}
            <div>
              <Label htmlFor="player-name" className="text-amber-200/80 mb-2 block font-serif text-sm tracking-wider uppercase">
                Votre Nom
              </Label>
              <Input
                id="player-name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (roomCode.trim() ? joinRoom() : createRoom()); }}
                placeholder="Entrez dans l'arène…"
                maxLength={24}
                autoComplete="nickname"
                className="bg-black/50 border-amber-800/50 text-amber-50 placeholder-amber-200/30 font-serif"
              />
            </div>

            <Tabs defaultValue={roomCode ? 'join' : 'create'} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-black/50 border border-amber-800/40">
                <TabsTrigger value="create" className="text-amber-200/80 data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-100 font-serif">
                  Forger un Pacte
                </TabsTrigger>
                <TabsTrigger value="join" className="text-amber-200/80 data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-100 font-serif">
                  Rejoindre
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4 pt-4">
                <Button
                  onClick={createRoom}
                  disabled={!playerName.trim() || busy}
                  className="w-full oath-btn-primary py-6"
                >
                  {busy ? 'Ouverture des portes…' : 'Sceller le Serment'}
                </Button>
                <Button
                  onClick={quickPlay}
                  disabled={!playerName.trim() || busy}
                  variant="outline"
                  className="w-full py-5 bg-black/40 border-amber-700/60 text-amber-100 hover:bg-amber-950/50 font-serif"
                >
                  ⚔️ Partie rapide contre 5 bots
                </Button>
                <p className="text-center text-xs text-amber-200/60 font-serif italic">
                  {playerName.trim()
                    ? "Seul ? La partie rapide démarre tout de suite. Entre amis, scellez le serment et partagez le code."
                    : "Entrez d'abord votre nom ci-dessus."}
                </p>
              </TabsContent>

              <TabsContent value="join" className="space-y-4 pt-4">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                  placeholder="Code du royaume…"
                  aria-label="Code de la salle"
                  className="bg-black/50 border-amber-800/50 text-amber-50 placeholder-amber-200/30 font-serif tracking-widest text-center uppercase"
                  maxLength={6}
                />
                <Button
                  onClick={() => joinRoom()}
                  disabled={!playerName.trim() || !roomCode.trim() || busy}
                  className="w-full oath-btn-primary py-6"
                >
                  {busy ? 'Ouverture des portes…' : "Entrer dans l'Ombre"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="darkoath-subtitle text-xs mt-10 italic tracking-wider">
          « Que celui qui jure ne brise pas son serment. »
        </p>
      </div>
    </div>
  );
};

// Lobby Component
const Lobby = ({ roomCode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [pending, setPending] = useState(false);
  const [showTuto, setShowTuto] = useState(false);
  const joinedRef = useRef(false);

  const currentPlayerId = localStorage.getItem('userId');
  const isHost = !!currentPlayerId && hostId === currentPlayerId;

  const loadPlayers = React.useCallback(async () => {
    try {
      const response = await axios.get(`${API}/rooms/${roomCode}`);
      const list = response.data.players || [];
      setPlayers(list);
      setHostId(response.data.host_id || null);
      setLoading(false);
      if (joinedRef.current && !list.some((p) => p.id === currentPlayerId)) {
        toast.error("Vous n'êtes plus dans cette salle.");
        forgetRoom();
        navigate('/');
        return;
      }
      if (response.data.status === 'in_progress') {
        setGameStarted(true);
        navigate(`/game/${roomCode}`);
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        toast.error('Cette salle a disparu.');
        forgetRoom();
        navigate('/');
      }
      setLoading(false);
    }
  }, [roomCode, currentPlayerId, navigate]);

  useEffect(() => {
    if (!currentPlayerId) {
      // Invitation link opened without an identity: go pick a name first.
      navigate(`/?join=${roomCode}`);
      return undefined;
    }
    let cancelled = false;
    let interval = null;
    (async () => {
      try {
        await axios.post(`${API}/rooms/${roomCode}/join`);
        joinedRef.current = true;
        rememberRoom(roomCode);
      } catch (error) {
        if (error?.response?.status === 401) {
          navigate(`/?join=${roomCode}`);
          return;
        }
        toast.error(errorMessage(error, 'Impossible de rejoindre la salle.'));
        navigate('/');
        return;
      }
      if (cancelled) return;
      await loadPlayers();
      interval = setInterval(loadPlayers, 2000);
    })();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [roomCode, currentPlayerId, navigate, loadPlayers]);

  const lobbyAction = async (action_type, payload = {}) => {
    if (pending) return;
    setPending(true);
    try {
      await axios.post(`${API}/rooms/${roomCode}/action`, { action_type, payload });
      await loadPlayers();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const leaveRoom = async () => {
    joinedRef.current = false;
    try {
      await axios.post(`${API}/rooms/${roomCode}/action`, { action_type: 'LEAVE', payload: {} });
    } catch {}
    forgetRoom();
    navigate('/');
  };

  const inviteLink = `${window.location.origin}/?join=${roomCode}`;
  const copyInvite = async () => {
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'Dark Oath', text: `Rejoins ma partie de Dark Oath (code ${roomCode})`, url: inviteLink });
        return;
      }
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Lien d'invitation copié !");
    } catch {
      toast.message(`Code de la salle : ${roomCode}`);
    }
  };

  // Lobby music - Morceau 1, with shared volume/enable controls.
  const lobbyAudioRef = useRef(null);
  const [musicEnabled, setMusicEnabled] = useState(() => readEnabled(true));
  const [musicVolume, setMusicVolume] = useState(() => readVolume(0.3));

  useEffect(() => {
    const audio = new Audio('/music/morceau4.wav');
    audio.loop = true;
    audio.volume = readVolume(0.3);
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.preload = 'auto';
    lobbyAudioRef.current = audio;

    let started = false;
    const tryPlay = () => {
      if (started) return;
      if (!readEnabled(true)) return;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { started = true; }).catch(() => {});
      } else {
        started = true;
      }
    };
    tryPlay();

    // iOS: retry on first user gesture if autoplay was blocked.
    const onGesture = () => {
      tryPlay();
      if (started) {
        document.removeEventListener('touchend', onGesture, true);
        document.removeEventListener('click', onGesture, true);
        document.removeEventListener('keydown', onGesture, true);
      }
    };
    document.addEventListener('touchend', onGesture, true);
    document.addEventListener('click', onGesture, true);
    document.addEventListener('keydown', onGesture, true);

    return () => {
      try { audio.pause(); } catch {}
      document.removeEventListener('touchend', onGesture, true);
      document.removeEventListener('click', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
      lobbyAudioRef.current = null;
    };
  }, []);

  // Volume live-update + persistence
  useEffect(() => {
    if (lobbyAudioRef.current) lobbyAudioRef.current.volume = musicVolume;
    localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume));
  }, [musicVolume]);

  // Enabled live-update + persistence
  useEffect(() => {
    const el = lobbyAudioRef.current;
    localStorage.setItem(MUSIC_ENABLED_KEY, String(musicEnabled));
    if (!el) return;
    if (musicEnabled) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      try { el.pause(); } catch {}
    }
  }, [musicEnabled]);

  const startGame = async () => {
    if (players.length < 5) {
      toast.error(`Il faut au moins 5 joueurs (actuellement ${players.length}). Ajoutez des bots !`);
      return;
    }
    try {
      setGameStarted(true);
      await axios.post(`${API}/rooms/${roomCode}/start`);
      navigate(`/game/${roomCode}`);
    } catch (error) {
      setGameStarted(false);
      toast.error(errorMessage(error, 'Impossible de lancer la partie.'));
    }
  };

  const embers = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 5.5) % 100}%`,
    delay: `${(i * 0.9) % 8}s`,
    duration: `${9 + ((i * 1.3) % 5)}s`,
    size: 2 + (i % 3),
  }));

  return (
    <div className="darkoath-landing">
      <Tutorial open={showTuto} onClose={() => setShowTuto(false)} />
      {embers.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={{
            left: e.left,
            animationDelay: e.delay,
            animationDuration: e.duration,
            width: `${e.size}px`,
            height: `${e.size}px`,
          }}
        />
      ))}

      {/* Music Control (toggle + volume slider) */}
      <div className="absolute top-4 right-4 z-20">
        <MusicControl
          enabled={musicEnabled}
          volume={musicVolume}
          onToggle={() => setMusicEnabled((v) => !v)}
          onVolume={setMusicVolume}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-start p-4 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <div className="darkoath-subtitle text-sm mb-3 uppercase tracking-widest">
              ✦ Salle du Serment ✦
            </div>
            <h1 className="darkoath-title text-4xl md:text-6xl mb-4">
              L'Antichambre
            </h1>
            <p className="darkoath-tagline text-lg mb-3">
              Les conjurés se rassemblent dans l'ombre…
            </p>
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded border border-amber-700/50 bg-black/50 backdrop-blur-sm">
              <span className="darkoath-subtitle text-xs uppercase tracking-widest">Code</span>
              <span className="darkoath-title text-2xl text-amber-200 tracking-[0.3em]">{roomCode}</span>
            </div>
          </div>

          <Card className="oath-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="darkoath-title text-2xl text-amber-200">
                    Conspirateurs réunis
                  </CardTitle>
                  <CardDescription className="darkoath-subtitle italic mt-1">
                    {players.length < 5
                      ? `${5 - players.length} âme${5 - players.length > 1 ? 's' : ''} encore attendue${5 - players.length > 1 ? 's' : ''}…`
                      : players.length < 10 ? "Le serment peut être scellé — ou attendez jusqu'à 10 âmes." : 'Le cercle est complet.'}
                  </CardDescription>
                </div>
                <div className="text-center px-4 py-2 rounded border border-amber-700/50 bg-black/40">
                  <div className="darkoath-title text-2xl text-amber-200 leading-none">
                    {players.length}<span className="text-amber-700/70">/10</span>
                  </div>
                  <div className="darkoath-subtitle text-[10px] uppercase tracking-widest mt-1">présents</div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {loading && (
                <div className="text-center p-6">
                  <div className="animate-spin h-8 w-8 border-4 border-amber-700 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="darkoath-subtitle italic">Ouverture des portes…</p>
                </div>
              )}

              {!loading && (
                <>
                  <div className="grid gap-2">
                    {[...Array(10)].map((_, index) => {
                      const player = players[index];
                      const taken = !!player;
                      const isMe = taken && player.id === currentPlayerId;
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded border transition-all ${
                            taken
                              ? 'bg-gradient-to-r from-amber-950/50 to-black/60 border-amber-700/60 shadow-[0_0_15px_rgba(180,90,30,0.15)]'
                              : 'bg-black/40 border-amber-900/30 border-dashed'
                          } ${isMe ? 'ring-1 ring-amber-400/60' : ''}`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 ${
                              taken
                                ? 'bg-gradient-to-br from-amber-600 to-amber-900 text-amber-100 shadow-inner'
                                : 'bg-black/60 text-amber-200/40 border border-amber-900/30'
                            }`} style={{ fontFamily: "'Lora', Georgia, serif" }}>
                              {taken && player.is_bot ? '🤖' : index + 1}
                            </div>
                            <span className={`flex-1 min-w-0 truncate font-serif ${taken ? 'text-amber-100' : 'text-amber-200/40 italic'}`}>
                              {player ? player.name : 'Siège vide…'}
                              {isMe && <span className="ml-2 text-xs text-amber-300/80">(vous)</span>}
                            </span>
                            {taken && player.is_host && (
                              <span className="text-xs px-2 py-0.5 rounded font-serif bg-amber-900/50 text-amber-200 border border-amber-600/50" title="Hôte de la salle">
                                👑 hôte
                              </span>
                            )}
                            {taken && player.is_bot && (
                              <span className="text-xs px-2 py-0.5 rounded font-serif bg-slate-800/60 text-slate-200 border border-slate-600/50">
                                bot
                              </span>
                            )}
                            {taken && !player.is_bot && (
                              <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded font-serif tracking-wider ${
                                player.connected
                                  ? 'bg-green-900/50 text-green-300 border border-green-700/40'
                                  : 'bg-red-900/50 text-red-300 border border-red-700/40'
                              }`}>
                                {player.connected ? '● présent' : '○ absent'}
                              </span>
                            )}
                            {taken && isHost && !isMe && (
                              <button
                                type="button"
                                onClick={() => lobbyAction('REMOVE_PLAYER', { playerId: player.id })}
                                disabled={pending}
                                className="w-9 h-9 shrink-0 rounded border border-red-800/60 text-red-300 hover:bg-red-900/40 disabled:opacity-40"
                                aria-label={`Retirer ${player.name}`}
                                title="Retirer de la salle"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {isHost && (
                      <Button
                        onClick={() => lobbyAction('ADD_BOT')}
                        disabled={pending || players.length >= 10}
                        className="w-full oath-btn-primary py-5"
                      >
                        🤖 Ajouter un bot
                      </Button>
                    )}
                    <Button
                      onClick={copyInvite}
                      variant="outline"
                      className={`w-full py-5 bg-black/40 border-amber-700/60 text-amber-100 hover:bg-amber-950/50 ${isHost ? '' : 'sm:col-span-2'}`}
                    >
                      🔗 Inviter (copier le lien)
                    </Button>
                  </div>

                  {players.length >= 5 ? (
                    <div className="space-y-4">
                      <div className="oath-divider">LE SERMENT PEUT ÊTRE SCELLÉ</div>
                      {isHost ? (
                        <Button
                          onClick={startGame}
                          className="w-full oath-btn-primary py-6 text-lg"
                          disabled={gameStarted}
                        >
                          {gameStarted ? 'Le Serment se scelle…' : `Sceller le Serment (${players.length} joueurs)`}
                        </Button>
                      ) : (
                        <p className="text-center darkoath-tagline italic">En attente de l'hôte pour lancer la partie…</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-4 rounded border border-amber-900/40 bg-black/40">
                      <p className="darkoath-tagline italic">
                        Il faut au moins 5 âmes pour sceller le serment.
                      </p>
                      <p className="darkoath-subtitle text-sm mt-2">
                        {isHost
                          ? <>Invitez vos amis avec le code <span className="text-amber-300 tracking-widest">{roomCode}</span>, ou complétez avec des bots.</>
                          : <>Partagez le code <span className="text-amber-300 tracking-widest">{roomCode}</span> à vos conspirateurs.</>}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => setShowTuto(true)}
                    variant="outline"
                    className="w-full py-5 bg-black/40 border-amber-700/60 text-amber-100 hover:bg-amber-950/50"
                  >
                    🎓 Première partie ? Suivez le tutoriel (3 min)
                  </Button>

                  <div className="text-center">
                    <button type="button" onClick={leaveRoom} className="text-sm text-amber-200/60 hover:text-amber-100 underline underline-offset-4 font-serif">
                      Quitter la salle
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <p className="darkoath-subtitle text-xs mt-8 italic tracking-wider text-center">
            « Celui qui trahit le serment scelle son propre destin. »
          </p>
        </div>
      </div>
    </div>
  );
};

// Game Component Wrapper
const Game = ({ roomCode }) => {
  if (!roomCode) {
    console.error('No roomCode provided to Game component');
    return <div>Error: No room code</div>;
  }
  
  return <GameInterface roomCode={roomCode} />;
};

// Main App Component
function App() {
  return (
    <BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors closeButton />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/tutoriel" element={<TutorialPage />} />
        <Route path="/lobby/:roomCode" element={<LobbyWrapper />} />
        <Route path="/game/:roomCode" element={<GameWrapper />} />
        <Route path="/dashadmin" element={<DashAdmin />} />
      </Routes>
    </BrowserRouter>
  );
}

// Wrapper components to extract params
const LobbyWrapper = () => {
  const { roomCode } = useParams();
  return <Lobby roomCode={roomCode} />;
};

const GameWrapper = () => {
  const { roomCode } = useParams();
  return <Game roomCode={roomCode} />;
};

export default App;