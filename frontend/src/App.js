import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Crown, Sword, Shield, Users, Globe } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { useTranslation } from 'react-i18next';
import './i18n';
import axios from 'axios';
import io from 'socket.io-client';
import GameInterface from './components/GameInterface';
import GameDemo from './components/GameDemo.tsx';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Landing Page Component
const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

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
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
      
      <Card className="w-full max-w-4xl bg-amber-50/95 backdrop-blur-sm border-amber-200 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center items-center space-x-4">
            <Crown className="h-16 w-16 text-amber-600" />
            <div>
              <CardTitle className="text-4xl font-bold text-amber-900 font-serif">
                Secretus Regnum
              </CardTitle>
              <CardDescription className="text-xl text-amber-700 mt-2">
                {t('subtitle')}
              </CardDescription>
            </div>
          </div>
          
          {/* Language Switcher */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
              className="bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
            >
              <Globe className="h-4 w-4 mr-2" />
              {i18n.language === 'fr' ? 'English' : 'Français'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Game Description */}
          <div className="bg-amber-100/50 p-6 rounded-lg border border-amber-200">
            <h3 className="text-2xl font-bold text-amber-900 mb-4 flex items-center">
              <Shield className="h-6 w-6 mr-2" />
              {t('gameDescription.title')}
            </h3>
            <p className="text-amber-800 text-lg leading-relaxed mb-4">
              {t('gameDescription.text')}
            </p>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-100 rounded-lg border border-blue-200">
                <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-bold text-blue-800">{t('roles.loyal')}</h4>
                <p className="text-sm text-blue-700">{t('roles.loyalDesc')}</p>
              </div>
              <div className="text-center p-4 bg-red-100 rounded-lg border border-red-200">
                <Sword className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <h4 className="font-bold text-red-800">{t('roles.conjure')}</h4>
                <p className="text-sm text-red-700">{t('roles.conjureDesc')}</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg border border-purple-200">
                <Crown className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h4 className="font-bold text-purple-800">{t('roles.usurpateur')}</h4>
                <p className="text-sm text-purple-700">{t('roles.usurpateurDesc')}</p>
              </div>
            </div>
          </div>

          {/* Join/Create Section */}
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-amber-100">
              <TabsTrigger value="create" className="data-[state=active]:bg-amber-200">
                {t('actions.createRoom')}
              </TabsTrigger>
              <TabsTrigger value="join" className="data-[state=active]:bg-amber-200">
                {t('actions.joinRoom')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name" className="text-amber-900">
                    {t('form.playerName')}
                  </Label>
                  <Input
                    id="create-name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder={t('form.playerNamePlaceholder')}
                    className="bg-white border-amber-300 focus:border-amber-500"
                    maxLength={20}
                  />
                </div>
                <Button 
                  onClick={createRoom}
                  disabled={!playerName.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg py-6"
                >
                  <Users className="h-5 w-5 mr-2" />
                  {t('actions.createRoom')}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="join" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="join-name" className="text-amber-900">
                    {t('form.playerName')}
                  </Label>
                  <Input
                    id="join-name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder={t('form.playerNamePlaceholder')}
                    className="bg-white border-amber-300 focus:border-amber-500"
                    maxLength={20}
                  />
                </div>
                <div>
                  <Label htmlFor="room-code" className="text-amber-900">
                    {t('form.roomCode')}
                  </Label>
                  <Input
                    id="room-code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="ABCDEF"
                    className="bg-white border-amber-300 focus:border-amber-500 font-mono text-center text-lg"
                    maxLength={6}
                  />
                </div>
                <Button 
                  onClick={joinRoom}
                  disabled={!playerName.trim() || !roomCode.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg py-6"
                >
                  <Sword className="h-5 w-5 mr-2" />
                  {t('actions.joinRoom')}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Rules Link */}
          <div className="text-center">
            <Button variant="link" className="text-amber-700 hover:text-amber-900">
              {t('actions.readRules')}
            </Button>
          </div>
        </CardContent>
      </Card>
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

// Game Component - Now uses GameInterface
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
        <Route path="/demo" element={<GameDemo />} />
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