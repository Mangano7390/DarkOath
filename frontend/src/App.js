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
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-3xl text-gray-100 flex items-center space-x-3">
                  <BookOpen className="h-8 w-8 text-amber-400" />
                  <span>Règles de Dark Oath</span>
                </CardTitle>
                <Button 
                  onClick={() => setShowRules(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Retour
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-6">
              <section>
                <h3 className="text-xl font-bold text-amber-400 mb-3">🎯 Objectif du Jeu</h3>
                <p>Dark Oath est un jeu de déduction sociale où Fidèles et Traîtres s'affrontent dans l'ombre. Les <strong className="text-blue-400">Fidèles</strong> tentent de préserver la Couronne, tandis que les <strong className="text-red-400">Traîtres</strong> et leur mystérieux <strong className="text-purple-400">Tyran</strong> conspirent pour prendre le pouvoir.</p>
              </section>

              <section>
                <h3 className="text-xl font-bold text-amber-400 mb-3">👥 Composition (5-10 joueurs)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold text-blue-400 mb-2">🛡️ Fidèles</h4>
                    <ul className="text-sm space-y-1">
                      <li>5 joueurs : 3 Fidèles</li>
                      <li>6 joueurs : 4 Fidèles</li>
                      <li>7 joueurs : 4 Fidèles</li>
                      <li>8 joueurs : 5 Fidèles</li>
                      <li>9 joueurs : 5 Fidèles</li>
                      <li>10 joueurs : 6 Fidèles</li>
                    </ul>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold text-red-400 mb-2">⚔️ Traîtres + 👑 Tyran</h4>
                    <ul className="text-sm space-y-1">
                      <li>5 joueurs : 1 Traître + 1 Tyran</li>
                      <li>6 joueurs : 1 Traître + 1 Tyran</li>
                      <li>7 joueurs : 2 Traîtres + 1 Tyran</li>
                      <li>8 joueurs : 2 Traîtres + 1 Tyran</li>
                      <li>9 joueurs : 3 Traîtres + 1 Tyran</li>
                      <li>10 joueurs : 3 Traîtres + 1 Tyran</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-amber-400 mb-3">🏆 Conditions de Victoire</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-blue-900 p-4 rounded-lg border border-blue-700">
                    <h4 className="font-bold text-blue-300 mb-2">🛡️ Victoire Fidèles</h4>
                    <p className="text-sm">Adopter 5 Décrets Loyaux OU exécuter le Tyran</p>
                  </div>
                  <div className="bg-red-900 p-4 rounded-lg border border-red-700">
                    <h4 className="font-bold text-red-300 mb-2">⚔️ Victoire Traîtres</h4>
                    <p className="text-sm">Adopter 6 Décrets de Trahison OU le Tyran devient Chancelier après 3+ Décrets de Trahison</p>
                  </div>
                  <div className="bg-purple-900 p-4 rounded-lg border border-purple-700">
                    <h4 className="font-bold text-purple-300 mb-2">👑 Victoire Tyran</h4>
                    <p className="text-sm">Être élu Chancelier après 3 Décrets de Trahison adoptés (gagne avec les Traîtres)</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-amber-400 mb-3">⚡ Piste de Crise</h3>
                <p>Quand un gouvernement est rejeté 3 fois consécutives, le décret du dessus de la pioche est automatiquement adopté. La piste de crise se remet à zéro après chaque gouvernement accepté.</p>
              </section>

              <section>
                <h3 className="text-xl font-bold text-amber-400 mb-3">🎮 Déroulement d'une Manche</h3>
                <div className="space-y-3">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <h4 className="font-bold text-yellow-400">1. Nomination</h4>
                    <p className="text-sm">Le Roi nomme un Chancelier pour l'assister.</p>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <h4 className="font-bold text-yellow-400">2. Vote</h4>
                    <p className="text-sm">Tous les joueurs (sauf Roi et Chancelier) votent OUI ou NON pour approuver le gouvernement.</p>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <h4 className="font-bold text-yellow-400">3. Phase Législative</h4>
                    <p className="text-sm">Si approuvé : le Roi puis le Chancelier choisissent quels décrets adopter parmi 3 cartes tirées.</p>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <h4 className="font-bold text-yellow-400">4. Pouvoirs Spéciaux</h4>
                    <p className="text-sm">Certains décrets de trahison accordent des pouvoirs au Roi (Investigation à 2+, Exécution à 4+).</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-amber-400 mb-3">🎭 Conseils Tactiques</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-bold text-blue-400 mb-2">Pour les Fidèles :</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      <li>Observez les votes et comportements suspects</li>
                      <li>Utilisez les pouvoirs d'investigation à bon escient</li>
                      <li>Méfiez-vous des joueurs trop coopératifs</li>
                      <li>Identifiez et exécutez le Tyran</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-red-400 mb-2">Pour les Traîtres :</h4>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      <li>Semez la discorde sans vous exposer</li>
                      <li>Aidez le Tyran à accéder au poste de Chancelier</li>
                      <li>Votez stratégiquement pour faire échouer les bons gouvernements</li>
                      <li>Adoptez 3+ Décrets de Trahison avant de pousser le Tyran</li>
                    </ul>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
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

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-gray-800 border-gray-700 shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-3xl text-amber-400">
                  Salle de Conspiration
                </CardTitle>
                <CardDescription className="text-xl text-gray-300">
                  Code: <span className="font-mono font-bold text-amber-400">{roomCode}</span>
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2 bg-amber-600 text-black">
                {players.length}/10 Conspirateurs
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {loading && (
              <div className="text-center p-6">
                <div className="animate-spin h-8 w-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-300">Chargement du salon...</p>
              </div>
            )}
            
            {!loading && (
              <>
                {/* Players List */}
                <div className="grid gap-4">
                  <h3 className="text-xl font-bold text-gray-100">Liste des Conspirateurs</h3>
                  <div className="grid gap-2">
                    {[...Array(10)].map((_, index) => {
                      const player = players[index];
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 ${
                            player 
                              ? 'bg-green-900 border-green-600 text-green-100' 
                              : 'bg-gray-800 border-gray-600 text-gray-500'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-amber-600 text-black flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <span className="font-medium">
                              {player ? player.name : 'En attente d\'un conspirateur...'}
                            </span>
                            {player && (
                              <Badge variant={player.connected ? "default" : "destructive"}>
                                {player.connected ? 'Connecté' : 'Déconnecté'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Start Game Button */}
                {players.length >= 5 && (
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-green-900 rounded-lg border border-green-600">
                      <p className="text-green-100 text-lg font-semibold">
                        ✅ Assez de conspirateurs pour commencer !
                      </p>
                      <p className="text-green-300 text-sm mt-1">
                        {players.length} joueurs prêts • {5 - players.length < 0 ? 0 : 5 - players.length} minimum requis
                      </p>
                    </div>
                    
                    <Button 
                      onClick={startGame}
                      className="w-full py-3 text-lg bg-amber-600 hover:bg-amber-700 text-black font-bold"
                      disabled={gameStarted}
                    >
                      {gameStarted ? 'Démarrage en cours...' : 'Commencer Dark Oath'}
                    </Button>
                  </div>
                )}

                {players.length < 5 && (
                  <div className="text-center p-4 bg-yellow-900 rounded-lg border border-yellow-600">
                    <p className="text-yellow-100 text-lg font-semibold">
                      ⏳ En attente de plus de conspirateurs
                    </p>
                    <p className="text-yellow-300 text-sm mt-1">
                      {players.length}/5 minimum • Jusqu'à 10 joueurs possibles
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
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