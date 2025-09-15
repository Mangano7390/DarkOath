import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const ConseilRoyaumePanel = ({ 
  gameState, 
  currentPlayerId, 
  onSpeakToggle,
  speakingPlayers = [] 
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [micEnabled, setMicEnabled] = useState(false);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  // Calculate time left based on start time
  useEffect(() => {
    if (gameState?.conseil_royaume_start_time) {
      const updateTimer = () => {
        const now = Date.now() / 1000;
        const elapsed = now - gameState.conseil_royaume_start_time;
        const remaining = Math.max(0, 60 - elapsed);
        setTimeLeft(Math.ceil(remaining));
        
        if (remaining <= 0) {
          // Time's up - disable microphone
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          setMicEnabled(false);
          setIsSpeaking(false);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.conseil_royaume_start_time]);

  // Initialize microphone access
  const initializeMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicEnabled(true);
      
      // Optional: You could add WebRTC peer-to-peer audio here
      // For now, this just enables microphone access
      console.log('Microphone access granted');
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions de votre navigateur.');
    }
  };

  useEffect(() => {
    // Auto-initialize microphone when council phase starts
    if (gameState?.phase === 'CONSEIL_ROYAUME' && !micEnabled) {
      initializeMicrophone();
    }
    
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [gameState?.phase, micEnabled]);

  const toggleSpeaking = async () => {
    if (!micEnabled || timeLeft <= 0) return;
    
    const newSpeakingState = !isSpeaking;
    setIsSpeaking(newSpeakingState);
    
    // Call backend to update speaking status
    await onSpeakToggle();
  };

  const formatTime = (seconds) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <Card className="bg-amber-900 border-amber-700 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center space-x-2 text-amber-100">
          <span>🕯️</span>
          <span>Conseil du Royaume</span>
          <span>🕯️</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer */}
        <div className="flex items-center justify-center space-x-2 bg-amber-800 p-3 rounded-lg">
          <Clock className="h-6 w-6 text-amber-200" />
          <span className="text-2xl font-bold text-amber-100">
            {formatTime(timeLeft)}
          </span>
          <span className="text-amber-200 text-sm">restantes</span>
        </div>

        {/* Speaking Instructions */}
        <div className="text-center bg-amber-800 p-3 rounded-lg">
          <p className="text-amber-100 font-medium mb-2">
            Vous pouvez parler librement pendant cette phase
          </p>
          <p className="text-amber-200 text-sm">
            Utilisez le bouton microphone ci-dessous (60 secondes)
          </p>
        </div>

        {/* Microphone Button */}
        <div className="flex justify-center">
          <Button
            onMouseDown={toggleSpeaking} // Push-to-talk option
            onClick={toggleSpeaking} // Toggle option
            disabled={!micEnabled || timeLeft <= 0}
            className={`h-16 w-16 rounded-full transition-all ${
              isSpeaking
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/50'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSpeaking ? (
              <MicOff className="h-8 w-8 text-white" />
            ) : (
              <Mic className="h-8 w-8 text-white" />
            )}
          </Button>
        </div>

        {/* Speaking Status */}
        <div className="text-center">
          {isSpeaking ? (
            <p className="text-red-400 font-medium">🔴 Microphone actif</p>
          ) : (
            <p className="text-green-400 font-medium">⚪ Microphone inactif</p>
          )}
        </div>

        {/* Speaking Players List */}
        {speakingPlayers.length > 0 && (
          <div className="bg-amber-800 p-3 rounded-lg">
            <h4 className="text-amber-200 font-medium mb-2">Actuellement en train de parler :</h4>
            <div className="flex flex-wrap gap-2">
              {speakingPlayers.map(seat => (
                <span 
                  key={seat} 
                  className="bg-red-600 text-white px-2 py-1 rounded-full text-sm font-medium"
                >
                  🔴 Siège {seat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rules Reminder */}
        <div className="bg-blue-900 p-3 rounded-lg border border-blue-700">
          <p className="text-blue-100 text-sm">
            <strong>Règle :</strong> Cette phase permet à tous les joueurs de discuter 
            librement pendant 30 secondes après la révélation d'un décret. 
            Le chat écrit reste disponible.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConseilRoyaumePanel;