import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
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
import io from 'socket.io-client';
import GameInterface from './components/GameInterface';
import SimpleDemo from './components/SimpleDemo';
import DashAdmin from './components/DashAdmin';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Landing Page Component with Dark Medieval Design
const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [musicEnabled, setMusicEnabled] = useState(true); // Auto-start music
  const [showRules, setShowRules] = useState(false);

  // Track a site visit once per session
  useEffect(() => {
    if (sessionStorage.getItem('darkoath_visit_tracked') === '1') return;
    axios.post(`${API}/track/visit`).then(() => {
      sessionStorage.setItem('darkoath_visit_tracked', '1');
    }).catch(() => {});
  }, []);

  // Medieval music control - Auto-play by default (Morceau 3)
  useEffect(() => {
    const audio = new Audio('https://customer-assets.emergentagent.com/job_1a735b74-0d1b-4cfc-aa0c-5d6b585ff99b/artifacts/l96z3xc1_Morceau%203.mp3');
    audio.loop = true;
    audio.volume = 0.3;

    // Auto-start music when page loads
    const startMusic = async () => {
      try {
        await audio.play();
        setMusicEnabled(true);
      } catch (error) {
        // Browser blocks autoplay, user will need to click
        console.log('Autoplay blocked, user interaction required');
        setMusicEnabled(false);
      }
    };

    startMusic();

    // Handle manual music control
    if (musicEnabled) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }

    return () => {
      audio.pause();
    };
  }, [musicEnabled]);

  const createRoom = async () => {
    console.log('createRoom called with playerName:', playerName);
    if (!playerName.trim()) {
      console.log('No player name provided');
      return;
    }
    
    try {
      console.log('Creating anonymous user...');
      // Create anonymous user
      const userResponse = await axios.post(`${API}/auth/anonymous?name=${encodeURIComponent(playerName)}`);
      console.log('User response:', userResponse.data);
      const { userId } = userResponse.data;
      
      console.log('Creating room...');
      // Create room
      const roomResponse = await axios.post(`${API}/rooms`);
      console.log('Room response:', roomResponse.data);
      const { code } = roomResponse.data;
      
      // Store user data in localStorage
      localStorage.setItem('userId', userId);
      localStorage.setItem('playerName', playerName);
      
      console.log('Navigating to lobby:', `/lobby/${code}`);
      navigate(`/lobby/${code}`);
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    
    try {
      // Create anonymous user
      const userResponse = await axios.post(`${API}/auth/anonymous?name=${encodeURIComponent(playerName)}`);
      const { userId } = userResponse.data;
      
      // Check if room exists
      await axios.get(`${API}/rooms/${roomCode.toUpperCase()}`);
      
      // Store user data in localStorage
      localStorage.setItem('userId', userId);
      localStorage.setItem('playerName', playerName);
      
      navigate(`/lobby/${roomCode.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
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
                <p className="text-amber-100/90 leading-relaxed mb-3" style={{ fontFamily: "'IM Fell English', serif" }}>
                  Dark Oath est un jeu de <strong>déduction sociale</strong> pour <strong>5 à 10 joueurs</strong>. Deux camps s'affrontent en secret&nbsp;: les <strong className="text-blue-300">Fidèles</strong> défendent la Couronne, les <strong className="text-red-400">Traîtres</strong> et leur <strong className="text-purple-300">Tyran</strong> la font tomber.
                </p>
                <p className="text-amber-100/85 leading-relaxed" style={{ fontFamily: "'IM Fell English', serif" }}>
                  À chaque tour, un <strong>Roi</strong> choisit un <strong>Conseiller</strong>, la table vote pour les approuver, puis ils adoptent un décret. Les décrets remplissent deux pistes&nbsp;: l'une mène à la victoire des Fidèles, l'autre à celle des Traîtres. Mentir, démasquer, manipuler&nbsp;: tout est permis.
                </p>
              </section>

              {/* Rôles — SECTION PRIORITAIRE */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-5" style={{ fontSize: '1.6rem' }}>
                  🎭 &nbsp;Les Rôles
                </h3>
                <p className="text-amber-100/80 text-sm italic mb-5" style={{ fontFamily: "'IM Fell English', serif" }}>
                  Votre rôle est <strong>secret</strong>. Il vous est révélé au début de la partie et ne change jamais.
                </p>
                <div className="space-y-4">
                  <div className="role-card role-card--fidele p-5">
                    <h4 className="font-bold text-blue-300 mb-2 text-lg" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}>🛡️ FIDÈLE</h4>
                    <p className="text-sm text-amber-100/90 mb-2 leading-relaxed"><strong>But&nbsp;:</strong> protéger la Couronne en adoptant 5 Décrets Loyaux, ou en faisant exécuter le Tyran.</p>
                    <p className="text-sm text-amber-100/75 leading-relaxed"><strong>Ce que vous savez&nbsp;:</strong> uniquement votre propre rôle. Vous devez déduire qui sont les Traîtres à travers les votes, les décrets et les discussions.</p>
                  </div>
                  <div className="role-card role-card--traitre p-5">
                    <h4 className="font-bold text-red-300 mb-2 text-lg" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}>⚔️ TRAÎTRE</h4>
                    <p className="text-sm text-amber-100/90 mb-2 leading-relaxed"><strong>But&nbsp;:</strong> saboter la Couronne en adoptant 6 Décrets de Trahison, ou en faisant élire le Tyran au poste de Conseiller après 3+ Décrets de Trahison.</p>
                    <p className="text-sm text-amber-100/75 leading-relaxed"><strong>Ce que vous savez&nbsp;:</strong> l'identité des autres Traîtres <strong>et</strong> du Tyran. Votre mission&nbsp;: semer le doute sans vous faire démasquer.</p>
                  </div>
                  <div className="role-card role-card--tyran p-5">
                    <h4 className="font-bold text-purple-300 mb-2 text-lg" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.1em' }}>👑 TYRAN</h4>
                    <p className="text-sm text-amber-100/90 mb-2 leading-relaxed"><strong>But&nbsp;:</strong> être élu Conseiller après que 3 Décrets de Trahison ont été adoptés (victoire immédiate avec les Traîtres).</p>
                    <p className="text-sm text-amber-100/75 leading-relaxed"><strong>Ce que vous savez&nbsp;:</strong>
                      {' '}À <strong>5-6 joueurs</strong>, vous connaissez les Traîtres. À <strong>7+ joueurs</strong>, vous êtes seul — les Traîtres savent qui vous êtes, mais vous les ignorez. Agissez comme un Fidèle pour passer inaperçu jusqu'au bon moment.
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
                      <tr className="text-left border-b" style={{ borderColor: 'rgba(199, 168, 105, 0.3)', fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>
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
                    { num: '1', title: 'Nomination', text: "Le Roi (désigné à tour de rôle autour de la table) propose un Conseiller parmi les joueurs éligibles." },
                    { num: '2', title: 'Vote', text: "Tous les joueurs vivants votent OUI ou NON à la majorité simple. Si OUI, le gouvernement est formé. Si NON ou égalité, on passe au joueur suivant et la Piste de Crise avance d'une case." },
                    { num: '3', title: 'Législation — le Roi', text: "Le Roi pioche 3 décrets, en défausse 1 secrètement, et transmet les 2 restants au Conseiller." },
                    { num: '4', title: 'Législation — le Conseiller', text: "Le Conseiller défausse 1 décret en secret et révèle le dernier. Ce décret est appliqué et avance la piste correspondante (Fidèles ou Trahison)." },
                    { num: '5', title: 'Pouvoir du Roi (si déclenché)', text: "Dès le 2ᵉ puis le 4ᵉ Décret de Trahison posé sur la piste des Traîtres, le Roi débloque un pouvoir (voir section Pouvoirs)." },
                    { num: '6', title: 'Conseil du Royaume', text: "Après chaque décret révélé, 30 secondes de discussion en vocal ouvert. Chacun peut s'exprimer, accuser, se justifier." },
                  ].map((step) => (
                    <div key={step.num} className="flex gap-4 items-start p-4 rounded-lg" style={{
                      background: 'linear-gradient(180deg, rgba(30, 20, 12, 0.6), rgba(18, 12, 8, 0.7))',
                      border: '1px solid rgba(199, 168, 105, 0.2)',
                    }}>
                      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-amber-200 font-bold" style={{
                        background: 'radial-gradient(circle, rgba(199, 168, 105, 0.25), rgba(90, 60, 20, 0.4))',
                        border: '1px solid rgba(199, 168, 105, 0.5)',
                        fontFamily: "'Cinzel', serif",
                      }}>
                        {step.num}
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-300 mb-1" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>{step.title}</h4>
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
                <p className="text-amber-100/85 text-sm leading-relaxed mb-5" style={{ fontFamily: "'IM Fell English', serif" }}>
                  Chaque décret adopté avance la piste de son camp. Le premier camp à remplir sa piste gagne. D'autres conditions peuvent aussi clore la partie immédiatement.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="role-card role-card--fidele p-5">
                    <h4 className="font-bold text-blue-300 mb-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>🛡️ FIDÈLES gagnent si</h4>
                    <ul className="text-sm text-amber-100/85 leading-relaxed space-y-1 list-disc list-inside">
                      <li>5 Décrets Loyaux adoptés, <strong>ou</strong></li>
                      <li>le Tyran est exécuté.</li>
                    </ul>
                  </div>
                  <div className="role-card role-card--traitre p-5">
                    <h4 className="font-bold text-red-300 mb-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>⚔️ TRAÎTRES gagnent si</h4>
                    <ul className="text-sm text-amber-100/85 leading-relaxed space-y-1 list-disc list-inside">
                      <li>6 Décrets de Trahison adoptés, <strong>ou</strong></li>
                      <li>le Tyran est élu Conseiller après 3+ Trahison.</li>
                    </ul>
                  </div>
                  <div className="role-card role-card--tyran p-5">
                    <h4 className="font-bold text-purple-300 mb-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>👑 TYRAN gagne</h4>
                    <p className="text-sm text-amber-100/85 leading-relaxed">avec les Traîtres — sa victoire personnelle est d'être élu Conseiller après 3 Décrets de Trahison.</p>
                  </div>
                </div>
              </section>

              {/* Pouvoirs */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  ⚜️ &nbsp;Pouvoirs du Roi
                </h3>
                <p className="text-amber-100/85 text-sm leading-relaxed mb-4" style={{ fontFamily: "'IM Fell English', serif" }}>
                  Les pouvoirs se débloquent selon le <strong>nombre de Décrets de Trahison</strong> posés sur la piste des Traîtres (et non selon le nombre de joueurs)&nbsp;:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 p-3 rounded" style={{ background: 'rgba(20, 14, 8, 0.6)', border: '1px solid rgba(199, 168, 105, 0.2)' }}>
                    <span className="text-red-300 font-bold min-w-[9rem]" style={{ fontFamily: "'Cinzel', serif" }}>2<sup>e</sup> Trahison</span>
                    <span className="text-amber-100/85"><strong>Investigation&nbsp;:</strong> le Roi consulte secrètement le camp (Fidèle / Traîtres) d'un autre joueur.</span>
                  </div>
                  <div className="flex gap-3 p-3 rounded" style={{ background: 'rgba(20, 14, 8, 0.6)', border: '1px solid rgba(199, 168, 105, 0.2)' }}>
                    <span className="text-red-300 font-bold min-w-[9rem]" style={{ fontFamily: "'Cinzel', serif" }}>4<sup>e</sup> Trahison</span>
                    <span className="text-amber-100/85"><strong>Exécution&nbsp;:</strong> le Roi élimine définitivement un joueur. Si c'était le Tyran, les Fidèles gagnent.</span>
                  </div>
                </div>
              </section>

              {/* Crise */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  ⚡ &nbsp;Colère du Peuple (Piste de Crise)
                </h3>
                <p className="text-amber-100/90 leading-relaxed" style={{ fontFamily: "'IM Fell English', serif" }}>
                  À chaque gouvernement rejeté, la Piste de Crise avance d'une case. Au <strong>3<sup>e</sup> rejet consécutif</strong>, le décret du dessus de la pioche est adopté <strong>automatiquement</strong>, le Roi est désavoué (inéligible au tour suivant), et la piste repart à zéro. Un gouvernement accepté remet également la piste à zéro.
                </p>
              </section>

              {/* Chat vocal */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  🕯️ &nbsp;Vocal & Chat
                </h3>
                <p className="text-amber-100/85 leading-relaxed text-sm mb-2" style={{ fontFamily: "'IM Fell English', serif" }}>
                  Le <strong>micro est ouvert en continu</strong> dès que la partie commence. Un chat écrit est également disponible à tout moment pour chuchoter, accuser ou conspirer.
                </p>
                <p className="text-amber-100/75 leading-relaxed text-sm" style={{ fontFamily: "'IM Fell English', serif" }}>
                  Un <strong>Conseil du Royaume</strong> de 30 secondes marque chaque révélation de décret&nbsp;: moment clé pour débattre avant le tour suivant.
                </p>
              </section>

              {/* Conseils */}
              <section className="oath-card p-6 md:p-8">
                <h3 className="darkoath-title mb-5" style={{ fontSize: '1.6rem' }}>
                  🗡️ &nbsp;Conseils Tactiques
                </h3>
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="role-card role-card--fidele p-5">
                    <h4 className="font-bold text-blue-300 mb-3" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>POUR LES FIDÈLES</h4>
                    <ul className="text-sm space-y-2 list-disc list-inside text-amber-100/85">
                      <li>Surveillez qui vote pour quels gouvernements.</li>
                      <li>Méfiez-vous des défausses trop commodes.</li>
                      <li>Utilisez vite l'Investigation — et communiquez ce que vous apprenez.</li>
                      <li>Au 4<sup>e</sup> Décret de Trahison, exécutez — mais choisissez bien votre cible.</li>
                    </ul>
                  </div>
                  <div className="role-card role-card--traitre p-5">
                    <h4 className="font-bold text-red-300 mb-3" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>POUR LES TRAÎTRES & LE TYRAN</h4>
                    <ul className="text-sm space-y-2 list-disc list-inside text-amber-100/85">
                      <li>Jouez la normalité tant que votre camp ne domine pas la piste.</li>
                      <li>Accusez un Fidèle pour détourner les soupçons.</li>
                      <li>À 3 Trahison, faites élire le Tyran au poste de Conseiller.</li>
                      <li>Le Tyran (7+ joueurs) doit se taire&nbsp;: il ignore qui sont ses alliés.</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* TL;DR */}
              <section className="oath-card p-6 md:p-8" style={{ borderColor: 'rgba(199, 168, 105, 0.5)' }}>
                <h3 className="darkoath-title mb-3" style={{ fontSize: '1.6rem' }}>
                  📜 &nbsp;Résumé en 5 lignes
                </h3>
                <ol className="space-y-2 text-sm md:text-base text-amber-100/90 leading-relaxed list-decimal list-inside" style={{ fontFamily: "'IM Fell English', serif" }}>
                  <li>Chaque joueur reçoit un rôle secret&nbsp;: <strong className="text-blue-300">Fidèle</strong>, <strong className="text-red-300">Traître</strong>, ou <strong className="text-purple-300">Tyran</strong>.</li>
                  <li>À chaque tour, un Roi nomme un Conseiller, la table vote, puis un décret est adopté.</li>
                  <li>5 Décrets Loyaux = Fidèles gagnent. 6 Décrets de Trahison = Traîtres gagnent.</li>
                  <li>Après 3 Trahison, élire le Tyran Conseiller fait gagner le camp du Mal <strong>immédiatement</strong>.</li>
                  <li>Exécuter le Tyran fait gagner les Fidèles. Mentez, déduisez, survivez.</li>
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

      {/* Music Control */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          onClick={() => setMusicEnabled(!musicEnabled)}
          variant="outline"
          size="sm"
          className="border-amber-700/60 text-amber-300 hover:bg-amber-900/30 bg-black/40 backdrop-blur-sm"
        >
          {musicEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
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
            Trois camps. Un trône. Une seule vérité.
          </p>
          <p className="darkoath-subtitle text-base md:text-lg mb-8 italic">
            Derrière chaque sourire, une lame. Derrière chaque vote, un complot.
          </p>

          <Button
            onClick={() => setShowRules(true)}
            variant="outline"
            className="border-amber-700/70 text-amber-300 hover:bg-amber-950/40 bg-black/40 backdrop-blur-sm"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Parchemin des Règles
          </Button>
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
                Semez la discorde en secret. Faites tomber le royaume pièce par pièce.
              </p>
            </div>
          </Card>

          <Card className="role-card role-card--tyran p-6">
            <div className="relative z-10 flex flex-col items-center text-center">
              <Crown className="h-14 w-14 text-purple-300 mb-4" strokeWidth={1.5} />
              <h3 className="darkoath-title text-2xl text-purple-200 mb-2">Le Tyran</h3>
              <div className="oath-divider w-full my-3">USURPATION</div>
              <p className="text-gray-300 text-sm leading-relaxed font-serif italic">
                L'ombre derrière le trône. Saisissez la couronne quand la nuit sera noire.
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
              5 à 10 âmes • 30 à 45 minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-amber-200/80 mb-2 block font-serif text-sm tracking-wider uppercase">
                Votre Nom
              </Label>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Entrez dans l'arène…"
                className="bg-black/50 border-amber-800/50 text-amber-50 placeholder-amber-200/30 font-serif"
              />
            </div>

            <Tabs defaultValue="create" className="w-full">
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
                  disabled={!playerName.trim()}
                  className="w-full oath-btn-primary py-6"
                >
                  Sceller le Serment
                </Button>
              </TabsContent>

              <TabsContent value="join" className="space-y-4 pt-4">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Code du royaume…"
                  className="bg-black/50 border-amber-800/50 text-amber-50 placeholder-amber-200/30 font-serif tracking-widest text-center uppercase"
                  maxLength={6}
                />
                <Button
                  onClick={joinRoom}
                  disabled={!playerName.trim() || !roomCode.trim()}
                  className="w-full oath-btn-primary py-6"
                >
                  Entrer dans l'Ombre
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
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  const currentPlayerId = localStorage.getItem('userId');
  const currentPlayerName = localStorage.getItem('playerName');

  useEffect(() => {
    if (!currentPlayerId) {
      navigate('/');
      return;
    }

    const joinRoom = async () => {
      try {
        console.log('Joining room with player:', currentPlayerName, currentPlayerId);
        const response = await axios.post(`${API}/rooms/${roomCode}/join`, null, {
          params: {
            player_id: currentPlayerId,
            player_name: currentPlayerName
          }
        });
        console.log('Join room response:', response.data);
      } catch (error) {
        console.error('Error joining room:', error);
        const detail = error?.response?.data?.detail;
        if (detail) {
          alert(detail);
        }
        navigate('/');
      }
    };

    joinRoom();

    const loadPlayers = async () => {
      try {
        const response = await axios.get(`${API}/rooms/${roomCode}`);
        console.log('Room data:', response.data);
        setPlayers(response.data.players || []);
        setLoading(false);
        
        if (response.data.status === 'in_progress') {
          setGameStarted(true);
          navigate(`/game/${roomCode}`);
        }
      } catch (error) {
        console.error('Error loading room:', error);
        setLoading(false);
      }
    };

    loadPlayers();
    const interval = setInterval(loadPlayers, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [roomCode, currentPlayerId, navigate, currentPlayerName]);

  // Lobby music - Morceau 1
  useEffect(() => {
    const audio = new Audio('https://customer-assets.emergentagent.com/job_1a735b74-0d1b-4cfc-aa0c-5d6b585ff99b/artifacts/10k0yrvs_Morceau%201.mp3');
    audio.loop = true;
    audio.volume = 0.3;

    // Auto-play lobby music
    audio.play().catch(console.error);

    return () => {
      audio.pause();
    };
  }, []);

  const startGame = async () => {
    console.log('startGame called for room:', roomCode);
    console.log('Current players:', players.length);
    
    if (players.length < 5) {
      alert(`Impossible de démarrer - il faut au minimum 5 joueurs (actuellement ${players.length})`);
      return;
    }
    
    try {
      console.log('Calling start game API...');
      const response = await axios.post(`${API}/rooms/${roomCode}/start`);
      console.log('Start game API response:', response.data);
      setGameStarted(true);
      console.log('Navigating to game:', `/game/${roomCode}`);
      navigate(`/game/${roomCode}`);
      console.log('Navigation completed');
    } catch (error) {
      console.error('Error starting game:', error);
      console.error('Error details:', error.response?.data);
      
      if (error.response?.status === 400) {
        alert('Impossible de démarrer le jeu - vérifiez que tous les joueurs sont connectés');
      } else {
        alert('Erreur lors du démarrage du jeu');
      }
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
                      : 'Le cercle est complet. Le serment peut être scellé.'}
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
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded border transition-all ${
                            taken
                              ? 'bg-gradient-to-r from-amber-950/50 to-black/60 border-amber-700/60 shadow-[0_0_15px_rgba(180,90,30,0.15)]'
                              : 'bg-black/40 border-amber-900/30 border-dashed'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 ${
                              taken
                                ? 'bg-gradient-to-br from-amber-600 to-amber-900 text-amber-100 shadow-inner'
                                : 'bg-black/60 text-amber-900/60 border border-amber-900/30'
                            }`} style={{ fontFamily: 'Cinzel, serif' }}>
                              {index + 1}
                            </div>
                            <span className={`flex-1 font-serif ${taken ? 'text-amber-100' : 'text-amber-900/60 italic'}`}>
                              {player ? player.name : 'Siège vide…'}
                            </span>
                            {taken && (
                              <span className={`text-xs px-2 py-0.5 rounded font-serif tracking-wider ${
                                player.connected
                                  ? 'bg-green-900/50 text-green-300 border border-green-700/40'
                                  : 'bg-red-900/50 text-red-300 border border-red-700/40'
                              }`}>
                                {player.connected ? '● présent' : '○ absent'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {players.length >= 5 ? (
                    <div className="space-y-4">
                      <div className="oath-divider">LE CERCLE EST COMPLET</div>
                      <Button
                        onClick={startGame}
                        className="w-full oath-btn-primary py-6 text-lg"
                        disabled={gameStarted}
                      >
                        {gameStarted ? 'Le Serment se scelle…' : 'Sceller le Serment'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-4 rounded border border-amber-900/40 bg-black/40">
                      <p className="darkoath-tagline italic">
                        Il faut au moins 5 âmes pour sceller le serment.
                      </p>
                      <p className="darkoath-subtitle text-sm mt-2">
                        Partagez le code <span className="text-amber-300 tracking-widest">{roomCode}</span> à vos conspirateurs.
                      </p>
                    </div>
                  )}
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/demo" element={<SimpleDemo />} />
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