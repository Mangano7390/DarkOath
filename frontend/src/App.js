
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Crown, Sword, Shield, Users, Globe, Music, Volume2, VolumeX } from 'lucide-react';
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
import MedievalGameRoom from './components/MedievalGameRoom';
import SimpleDemo from './components/SimpleDemo';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Landing Page Component with Medieval Design
const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [musicEnabled, setMusicEnabled] = useState(false);

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

  return (
    <div className="min-h-screen medieval-parchment relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 torch-flicker">🔥</div>
        <div className="absolute top-20 right-20 torch-flicker" style={{animationDelay: '1s'}}>🔥</div>
        <div className="absolute bottom-20 left-16 torch-flicker" style={{animationDelay: '2s'}}>🔥</div>
        <div className="absolute bottom-10 right-10 torch-flicker" style={{animationDelay: '0.5s'}}>🔥</div>
      </div>

      {/* Hero Image Section */}
      <div className="relative h-80 overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="flex items-center justify-center space-x-6 mb-6">
              <div className="heraldic-shield animate-pulse"></div>
              <div>
                <h1 className="font-uncial text-6xl mb-2 embossed-text text-white drop-shadow-lg">
                  Secretus Regnum
                </h1>
                <p className="font-fell text-xl italic opacity-90">
                  Un royaume en péril. Les trahisons se murmurent dans l'ombre.
                </p>
              </div>
              <div className="heraldic-shield animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
            <p className="font-fell text-lg max-w-2xl mx-auto leading-relaxed">
              Saurez-vous préserver la Couronne ou laisser l'Usurpateur s'en emparer ?
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Music Control */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMusicEnabled(!musicEnabled)}
            className="bg-black/20 border-white/30 text-white hover:bg-black/30"
          >
            {musicEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>

        {/* Language Switcher */}
        <div className="flex justify-center mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
            className="bg-red-800 text-yellow-200 border-yellow-600 hover:bg-red-700 font-cinzel font-semibold px-6 py-2"
          >
            <Globe className="h-4 w-4 mr-2" />
            {i18n.language === 'fr' ? 'English' : 'Français'}
          </Button>
        </div>

        {/* Main Content Card */}
        <Card className="worn-border medieval-parchment shadow-2xl">
          <CardContent className="p-8">
            {/* Game Description */}
            <div className="text-center mb-8">
              <h2 className="font-cinzel text-3xl font-bold text-amber-900 mb-4 embossed-text">
                ⚔️ À propos du jeu ⚔️
              </h2>
              <div className="ornate-divider"></div>
              <p className="font-fell text-lg text-amber-900 leading-relaxed max-w-4xl mx-auto">
                Dans Secretus Regnum, incarnez un noble dans un royaume en péril. Les Chevaliers Loyaux 
                tentent de préserver la stabilité du royaume, tandis que les Conjurés et leur mystérieux 
                Usurpateur conspirent pour prendre le pouvoir. Qui pouvez-vous faire confiance ?
              </p>
            </div>

            {/* Faction Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="role-card bg-blue-50">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-cinzel text-xl font-bold text-blue-800 mb-2">Chevaliers Loyaux</h3>
                  <p className="font-fell text-blue-700">Défendez le royaume et démasquez les traîtres</p>
                  <div className="mt-4 text-sm text-blue-600 font-semibold">
                    🛡️ Victoire: 5 Décrets Loyaux
                  </div>
                </div>
              </div>

              <div className="role-card bg-red-50">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center">
                    <Sword className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-cinzel text-xl font-bold text-red-800 mb-2">Conjurés</h3>
                  <p className="font-fell text-red-700">Répandez le chaos et aidez l'Usurpateur</p>
                  <div className="mt-4 text-sm text-red-600 font-semibold">
                    ⚔️ Victoire: 6 Décrets Conjurés
                  </div>
                </div>
              </div>

              <div className="role-card bg-purple-50">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center">
                    <Crown className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-cinzel text-xl font-bold text-purple-800 mb-2">Usurpateur</h3>
                  <p className="font-fell text-purple-700">Prenez le pouvoir en secret</p>
                  <div className="mt-4 text-sm text-purple-600 font-semibold">
                    👑 Victoire: Devenir Chambellan
                  </div>
                </div>
              </div>
            </div>

            <div className="ornate-divider"></div>

            {/* Join/Create Section */}
            <Tabs defaultValue="create" className="w-full max-w-2xl mx-auto">
              <TabsList className="grid w-full grid-cols-2 bg-amber-100 border-2 border-yellow-600">
                <TabsTrigger 
                  value="create" 
                  className="font-cinzel font-semibold data-[state=active]:bg-yellow-600 data-[state=active]:text-white"
                >
                  🏰 Créer une salle
                </TabsTrigger>
                <TabsTrigger 
                  value="join"
                  className="font-cinzel font-semibold data-[state=active]:bg-yellow-600 data-[state=active]:text-white"
                >
                  ⚔️ Rejoindre une salle
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="create" className="space-y-6 mt-8">
                <div className="text-center">
                  <h3 className="font-cinzel text-2xl font-bold text-amber-900 mb-4">
                    Créer un nouveau royaume
                  </h3>
                  <p className="font-fell text-amber-900 mb-6">
                    Fondez votre propre royaume et invitez vos compagnons d'armes
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="create-name" className="font-cinzel font-semibold text-amber-900">
                        Votre nom de noble
                      </Label>
                      <Input
                        id="create-name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Entrez votre nom..."
                        className="parchment-input font-fell text-center"
                        maxLength={20}
                      />
                    </div>
                    
                    <div className="flex justify-center py-4">
                      <div className="relative">
                        <button 
                          onClick={createRoom}
                          disabled={!playerName.trim()}
                          className="w-32 h-32 rounded-full bg-gradient-to-br from-red-800 to-red-900 border-4 border-red-900 text-white font-cinzel font-bold text-sm uppercase tracking-wider shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex flex-col items-center justify-center"
                          style={{
                            boxShadow: `
                              0 0 0 4px rgba(139, 21, 56, 0.3),
                              0 6px 20px rgba(139, 21, 56, 0.4),
                              inset 0 2px 4px rgba(255, 255, 255, 0.2),
                              inset 0 -2px 4px rgba(0, 0, 0, 0.3)
                            `
                          }}
                        >
                          <Users className="h-8 w-8 mb-1" />
                          <div className="text-xs leading-tight">
                            <div>CRÉER</div>
                            <div>ROYAUME</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="join" className="space-y-6 mt-8">
                <div className="text-center">
                  <h3 className="font-cinzel text-2xl font-bold text-amber-900 mb-4">
                    Rejoindre un royaume
                  </h3>
                  <p className="font-fell text-amber-900 mb-6">
                    Un seigneur vous a-t-il invité dans son château ?
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="join-name" className="font-cinzel font-semibold text-amber-900">
                        Votre nom de noble
                      </Label>
                      <Input
                        id="join-name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Entrez votre nom..."
                        className="parchment-input font-fell text-center"
                        maxLength={20}
                      />
                    </div>
                    <div>
                      <Label htmlFor="room-code" className="font-cinzel font-semibold text-amber-900">
                        Code du royaume
                      </Label>
                      <Input
                        id="room-code"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="ABCDEF"
                        className="parchment-input font-mono text-center text-lg font-bold tracking-widest"
                        maxLength={6}
                      />
                    </div>
                    
                    <Button 
                      onClick={joinRoom}
                      disabled={!playerName.trim() || !roomCode.trim()}
                      className="w-full bg-red-800 hover:bg-red-900 text-white font-cinzel font-semibold text-lg py-6 border-2 border-yellow-600 transition-all duration-300 hover:scale-105"
                    >
                      <Sword className="h-5 w-5 mr-2" />
                      Rallier le royaume {roomCode}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="text-center mt-12">
              <div className="ornate-divider"></div>
              <p className="font-fell text-amber-900/70 text-sm">
                🏰 Un jeu de déduction sociale pour 5-10 joueurs 🏰
              </p>
              <Button variant="link" className="font-fell text-yellow-600 hover:text-red-800 mt-2">
                📜 Lire les règles du royaume
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Lobby Component
const Lobby = ({ roomCode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Function to refresh room state
  const refreshRoomState = async () => {
    try {
      const response = await axios.get(`${API}/rooms/${roomCode}`);
      console.log('Room state updated:', response.data);
      setPlayers(response.data.players);
      return response.data;
    } catch (error) {
      console.error('Error refreshing room state:', error);
      return null;
    }
  };
  
  useEffect(() => {
    const joinRoom = async () => {
      const userId = localStorage.getItem('userId');
      const playerName = localStorage.getItem('playerName');
      
      console.log('Lobby component mounted for room:', roomCode);
      console.log('User data:', { userId, playerName });
      
      if (!userId || !playerName) {
        console.log('No user data found, redirecting to home');
        navigate('/');
        return;
      }
      
      try {
        console.log('Joining room...');
        await axios.post(`${API}/rooms/${roomCode}/join?player_id=${userId}&player_name=${encodeURIComponent(playerName)}`);
        
        console.log('Successfully joined room, getting initial state...');
        await refreshRoomState();
        setLoading(false);
        
      } catch (error) {
        console.error('Error joining room:', error);
        navigate('/');
      }
    };
    
    joinRoom();
    
    // Set up polling to refresh room state every 2 seconds 
    const interval = setInterval(async () => {
      await refreshRoomState();
    }, 2000);
    
    return () => {
      clearInterval(interval);
    };
  }, [roomCode, navigate]);

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
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-amber-50/95 backdrop-blur-sm border-amber-200 shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-3xl text-amber-900 font-serif">
                  {t('lobby.title')}
                </CardTitle>
                <CardDescription className="text-xl text-amber-700">
                  {t('lobby.code')}: <span className="font-mono font-bold">{roomCode}</span>
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {players.length}/10 {t('lobby.players')}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {loading && (
              <div className="text-center p-6">
                <div className="animate-spin h-8 w-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-amber-800">Chargement du salon...</p>
              </div>
            )}
            
            {!loading && (
              <>
                {/* Players List */}
                <div className="grid gap-4">
                  <h3 className="text-xl font-bold text-amber-900">{t('lobby.playersList')}</h3>
                  <div className="grid gap-2">
                    {[...Array(10)].map((_, index) => {
                      const player = players[index];
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 ${
                            player 
                              ? 'bg-green-100 border-green-300 text-green-800' 
                              : 'bg-gray-100 border-gray-300 text-gray-500'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
                              {index + 1}
                            </div>
                            <span className="font-medium">
                              {player ? player.name : t('lobby.waitingPlayer')}
                            </span>
                            {player && (
                              <Badge variant={player.connected ? "default" : "destructive"}>
                                {player.connected ? t('lobby.connected') : t('lobby.disconnected')}
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
                    <div className="text-center p-4 bg-green-100 rounded-lg border border-green-300">
                      <p className="text-green-800 text-lg font-semibold">
                        ✅ Assez de joueurs pour commencer !
                      </p>
                      <p className="text-green-700 text-sm">
                        {players.length} joueur(s) connecté(s) - Minimum 5, Maximum 10
                      </p>
                    </div>
                    <Button 
                      onClick={startGame}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-xl py-6"
                    >
                      <Crown className="h-6 w-6 mr-2" />
                      {t('lobby.startGame')} ({players.length} joueurs)
                    </Button>
                  </div>
                )}
                
                {players.length < 5 && (
                  <div className="text-center p-6 bg-amber-100 rounded-lg">
                    <p className="text-amber-800 text-lg">
                      {t('lobby.waitingForPlayers', { needed: 5 - players.length })}
                    </p>
                    <p className="text-amber-700 text-sm mt-2">
                      {players.length}/10 joueurs connectés (Minimum: 5)
                    </p>
                    <div className="mt-4">
                      <div className="w-full bg-amber-200 rounded-full h-3">
                        <div 
                          className="bg-amber-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${(Math.max(players.length, 5) / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <p className="text-amber-600 text-xs mt-2">
                      Partagez ce code avec vos amis : <span className="font-mono font-bold">{roomCode}</span>
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

// Game Component - Uses original GameInterface that was working
const Game = ({ roomCode }) => {
  console.log('Game component rendered with roomCode:', roomCode);
  
  // Check if roomCode exists
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