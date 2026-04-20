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
  const [isMuted, setIsMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [micInitialized, setMicInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // Mic is "open" whenever initialized AND not muted by user.
  const isSpeaking = micInitialized && !isMuted;

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
    setIsMuted(false);
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
    if (!AudioCtx) throw new Error('AudioContext non supporté par ce navigateur');
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    if (!ctx.audioWorklet) {
      throw new Error('AudioWorklet non supporté (iOS < 14.5 ou navigateur ancien)');
    }
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

    const wsUrl = `${WS_BASE}/ws/audio/${roomCode}/${currentPlayerId}`;
    console.log('[voice] opening ws:', wsUrl);
    // Wait for ws open (short) — otherwise first clicks send into a not-yet-open socket
    await new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      let settled = false;
      const cleanup = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onErr);
        ws.removeEventListener('close', onClose);
      };
      const onOpen = () => { if (settled) return; settled = true; cleanup(); resolve(); };
      const onErr = (e) => {
        if (settled) return;
        console.error('[voice] ws error event:', e);
      };
      const onClose = (e) => {
        if (settled) return; settled = true; cleanup();
        const detail = `code=${e.code} reason="${e.reason || ''}" wasClean=${e.wasClean} url=${wsUrl}`;
        console.error('[voice] ws closed before open:', detail);
        reject(new Error(`ws failed (${detail})`));
      };
      const timer = setTimeout(() => {
        if (settled) return; settled = true; cleanup();
        reject(new Error(`ws timeout after 10s (readyState=${ws.readyState}) url=${wsUrl}`));
      }, 10000);
      ws.addEventListener('open', () => { clearTimeout(timer); onOpen(); });
      ws.addEventListener('error', onErr);
      ws.addEventListener('close', (e) => { clearTimeout(timer); onClose(e); });
    });
  };

  const handleMicButton = async () => {
    // First tap: init (this IS a user gesture — iOS-safe). Mic stays open afterwards.
    if (!micInitialized) {
      if (initializing) return;
      setInitializing(true);
      setVoiceError(null);
      try {
        await initAudio();
        setMicInitialized(true);
        setIsMuted(false); // mic always open after init
        try {
          const result = onSpeakToggle?.();
          if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch {}
      } catch (err) {
        console.error('Voice init failed:', err);
        const detail = `${err?.name || 'Error'}: ${err?.message || String(err)}`;
        setVoiceError(
          err?.name === 'NotAllowedError'
            ? "Microphone refusé. Autorisez l'accès dans les réglages du navigateur."
            : `Impossible d'initialiser le vocal — ${detail}`,
        );
        teardown();
      } finally {
        setInitializing(false);
      }
      return;
    }

    // Subsequent taps: mute / unmute (mic pipeline stays alive)
    setIsMuted((prev) => {
      const next = !prev;
      try {
        const result = onSpeakToggle?.();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {}
      return next;
    });
  };

  const formatTime = (seconds) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const buttonDisabled = initializing;

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
              ? '🔊 Vocal ouvert en continu — cliquez pour couper'
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
            <p className="text-red-400 font-medium">🔴 Micro ouvert — on vous entend</p>
          ) : (
            <p className="text-gray-300 font-medium">🔇 Coupé — cliquez pour rouvrir</p>
          )}
        </div>

        {speakingPlayers.length > 0 && (
          <div className="bg-amber-800 p-3 rounded-lg">
            <h4 className="text-amber-200 font-medium mb-2">
              Actuellement en train de parler :
            </h4>
            <div className="flex flex-wrap gap-2">
              {speakingPlayers.map((seat) => {
                const p = gameState?.players?.find((pl) => pl.seat === seat);
                const label = p?.name || `Siège ${seat}`;
                return (
                  <span
                    key={seat}
                    className="bg-red-600 text-white px-2 py-1 rounded-full text-sm font-medium"
                  >
                    🔴 {label}
                  </span>
                );
              })}
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
