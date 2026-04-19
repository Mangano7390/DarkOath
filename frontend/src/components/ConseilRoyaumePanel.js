import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const WS_BASE = BACKEND_URL.replace(/^http/, 'ws');

const ConseilRoyaumePanel = ({
  gameState,
  roomCode,
  currentPlayerId,
  onSpeakToggle,
  speakingPlayers = [],
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [micInitialized, setMicInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const phase = gameState?.phase;
  const startTime = gameState?.conseil_royaume_start_time;

  // Refs — audio pipeline lives outside React state to avoid re-renders per chunk
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const micSourceRef = useRef(null);
  const wsRef = useRef(null);
  const speakingRef = useRef(false);
  const playbackRef = useRef(new Map()); // seat -> { nextTime }

  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Timer driven by server-provided start time
  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const elapsed = Date.now() / 1000 - startTime;
      setTimeLeft(Math.max(0, Math.ceil(60 - elapsed)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startTime]);

  const playChunk = useCallback((seat, sampleRate, int16) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const state = playbackRef.current.get(seat) || { nextTime: 0 };
    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, state.nextTime);
    src.start(startAt);
    state.nextTime = startAt + buffer.duration;
    playbackRef.current.set(seat, state);
  }, []);

  // Teardown helper — idempotent
  const teardown = useCallback(() => {
    setMicInitialized(false);
    setIsSpeaking(false);
    speakingRef.current = false;

    try {
      workletNodeRef.current?.port?.close?.();
      workletNodeRef.current?.disconnect?.();
    } catch {}
    try {
      micSourceRef.current?.disconnect?.();
    } catch {}
    try {
      audioCtxRef.current?.close?.();
    } catch {}
    workletNodeRef.current = null;
    micSourceRef.current = null;
    audioCtxRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    playbackRef.current.clear();
  }, []);

  // Tear down on phase exit or unmount (iOS-safe: no init in useEffect)
  useEffect(() => {
    if (phase !== 'CONSEIL_ROYAUME') {
      teardown();
    }
    return teardown;
  }, [phase, teardown]);

  // Init audio pipeline — MUST be called from a user gesture (iOS requirement)
  const initAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    await ctx.audioWorklet.addModule('/audio-worklet.js');

    const micSource = ctx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(ctx, 'capture-processor');
    micSource.connect(workletNode);
    // NB: do NOT connect the worklet to ctx.destination — echo.
    micSourceRef.current = micSource;
    workletNodeRef.current = workletNode;

    const ws = new WebSocket(
      `${WS_BASE}/ws/audio/${roomCode}/${currentPlayerId}`,
    );
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    const sampleRate = Math.round(ctx.sampleRate);
    const rateHeader = new Uint8Array(2);
    rateHeader[0] = (sampleRate >> 8) & 0xff;
    rateHeader[1] = sampleRate & 0xff;

    workletNode.port.onmessage = (ev) => {
      if (!speakingRef.current) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const pcm = new Uint8Array(ev.data);
      const frame = new Uint8Array(rateHeader.length + pcm.length);
      frame.set(rateHeader, 0);
      frame.set(pcm, rateHeader.length);
      wsRef.current.send(frame.buffer);
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      const view = new DataView(ev.data);
      if (view.byteLength < 5) return;
      const seat = view.getUint8(0);
      const rate = view.getUint16(2, false);
      const pcmBytes = new Int16Array(ev.data, 4, (view.byteLength - 4) / 2);
      playChunk(seat, rate, pcmBytes);
    };

    ws.onerror = () => setVoiceError('Connexion audio interrompue');

    // Wait for ws open (short) — otherwise first clicks send into a not-yet-open socket
    await new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      const onOpen = () => { ws.removeEventListener('open', onOpen); resolve(); };
      const onErr = () => { ws.removeEventListener('error', onErr); reject(new Error('ws failed')); };
      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onErr);
    });
  };

  // Force-stop speaking once the timer hits 0
  useEffect(() => {
    if (timeLeft <= 0 && isSpeaking) {
      setIsSpeaking(false);
    }
  }, [timeLeft, isSpeaking]);

  const handleMicButton = async () => {
    if (timeLeft <= 0) return;

    // First tap: init (this IS a user gesture — iOS-safe)
    if (!micInitialized) {
      if (initializing) return;
      setInitializing(true);
      setVoiceError(null);
      try {
        await initAudio();
        setMicInitialized(true);
        setIsSpeaking(true); // start speaking immediately on first tap
        try {
          const result = onSpeakToggle?.();
          if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch {}
      } catch (err) {
        console.error('Voice init failed:', err);
        setVoiceError(
          err?.name === 'NotAllowedError'
            ? "Microphone refusé. Autorisez l'accès dans les réglages du navigateur."
            : "Impossible d'initialiser le vocal.",
        );
        teardown();
      } finally {
        setInitializing(false);
      }
      return;
    }

    // Subsequent taps: toggle speaking state only
    setIsSpeaking((prev) => !prev);
    try {
      const result = onSpeakToggle?.();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {}
  };

  const formatTime = (seconds) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const buttonDisabled = timeLeft <= 0 || initializing;

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
        <div className="flex items-center justify-center space-x-2 bg-amber-800 p-3 rounded-lg">
          <Clock className="h-6 w-6 text-amber-200" />
          <span className="text-2xl font-bold text-amber-100">
            {formatTime(timeLeft)}
          </span>
          <span className="text-amber-200 text-sm">restantes</span>
        </div>

        <div className="text-center bg-amber-800 p-3 rounded-lg">
          <p className="text-amber-100 font-medium mb-2">
            Vous pouvez parler librement pendant cette phase
          </p>
          <p className="text-amber-200 text-sm">
            {micInitialized
              ? 'Cliquez sur le micro pour parler / couper'
              : 'Appuyez sur le micro pour activer le vocal'}
          </p>
        </div>

        {voiceError && (
          <div className="bg-red-900 border border-red-700 p-3 rounded-lg text-red-100 text-sm text-center">
            {voiceError}
          </div>
        )}

        <div className="flex justify-center">
          <Button
            onClick={handleMicButton}
            disabled={buttonDisabled}
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

        <div className="text-center">
          {initializing ? (
            <p className="text-amber-300 font-medium">⏳ Initialisation du micro…</p>
          ) : !micInitialized ? (
            <p className="text-amber-200 font-medium">🎙️ Appuyez pour activer</p>
          ) : isSpeaking ? (
            <p className="text-red-400 font-medium">🔴 Microphone actif</p>
          ) : (
            <p className="text-green-400 font-medium">⚪ Microphone inactif</p>
          )}
        </div>

        {speakingPlayers.length > 0 && (
          <div className="bg-amber-800 p-3 rounded-lg">
            <h4 className="text-amber-200 font-medium mb-2">
              Actuellement en train de parler :
            </h4>
            <div className="flex flex-wrap gap-2">
              {speakingPlayers.map((seat) => (
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

        <div className="bg-blue-900 p-3 rounded-lg border border-blue-700">
          <p className="text-blue-100 text-sm">
            <strong>Règle :</strong> Cette phase permet à tous les joueurs de
            discuter librement pendant 60 secondes après la révélation d'un
            décret. Le chat écrit reste disponible.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConseilRoyaumePanel;
