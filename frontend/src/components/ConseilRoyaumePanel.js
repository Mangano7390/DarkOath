import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const ConseilTimer = ({ startTime }) => {
  const [timeLeft, setTimeLeft] = useState(30);
  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const elapsed = Date.now() / 1000 - startTime;
      setTimeLeft(Math.max(0, Math.ceil(30 - elapsed)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startTime]);
  const urgent = timeLeft <= 10;
  return (
    <div
      className="flex items-center justify-center gap-3 p-4 rounded-lg"
      style={{
        background: urgent ? 'rgba(127, 29, 29, 0.55)' : 'rgba(120, 53, 15, 0.35)',
        border: `2px solid ${urgent ? '#dc2626' : '#c7a869'}`,
        boxShadow: urgent ? '0 0 18px rgba(220, 38, 38, 0.55)' : '0 0 10px rgba(199, 168, 105, 0.25)',
        animation: urgent ? 'pulse 1s infinite' : 'none',
      }}
    >
      <Clock className={`h-6 w-6 ${urgent ? 'text-red-200' : 'text-amber-200'}`} />
      <div className="flex flex-col items-center leading-tight">
        <span
          className="uppercase tracking-widest text-[10px] opacity-80"
          style={{ fontFamily: "'Cinzel', serif", color: urgent ? '#fecaca' : '#e8d9a8' }}
        >
          Conseil du Royaume
        </span>
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: '2rem', color: urgent ? '#fecaca' : '#e8d9a8', fontFamily: "'Cinzel', serif" }}
        >
          {timeLeft}s
        </span>
      </div>
    </div>
  );
};

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
  const [micInitialized, setMicInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // Mic is "open" whenever initialized AND not muted by user.
  const isSpeaking = micInitialized && !isMuted;

  const status = gameState?.status;

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const micSourceRef = useRef(null);
  const wsRef = useRef(null);
  const speakingRef = useRef(false);
  const playbackRef = useRef(new Map());
  const playbackDestRef = useRef(null); // MediaStreamAudioDestinationNode for iOS routing
  const playbackElRef = useRef(null);   // <audio> sink — routes output to loudspeaker on iOS

  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);

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
    // Route through MediaStream sink if available (iOS loudspeaker fix),
    // otherwise fall back to the default destination.
    src.connect(playbackDestRef.current || ctx.destination);

    const state = playbackRef.current.get(seat) || { nextTime: 0 };
    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, state.nextTime);
    src.start(startAt);
    state.nextTime = startAt + buffer.duration;
    playbackRef.current.set(seat, state);
  }, []);

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

    if (playbackElRef.current) {
      try { playbackElRef.current.pause(); } catch {}
      try { playbackElRef.current.srcObject = null; } catch {}
      try { playbackElRef.current.remove(); } catch {}
      playbackElRef.current = null;
    }
    playbackDestRef.current = null;

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

  // Tear down when game ends / unmounts
  useEffect(() => {
    if (status !== 'in_progress') {
      teardown();
    }
    return teardown;
  }, [status, teardown]);

  const initAudio = async () => {
    // iOS Safari: getUserMedia must be called synchronously inside the user
    // gesture. We await it first before creating the AudioContext.
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

    // iOS unlock: resume + play a silent buffer so the destination is "warm"
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch {}
    }
    try {
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const silentSrc = ctx.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(ctx.destination);
      silentSrc.start(0);
    } catch {}

    // iOS loudspeaker fix: when getUserMedia is active, Safari routes audio
    // output to the earpiece (like a phone call). Piping playback through an
    // <audio> element's MediaStream keeps it on the loudspeaker.
    try {
      const dest = ctx.createMediaStreamDestination();
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.setAttribute('playsinline', '');
      audioEl.setAttribute('webkit-playsinline', '');
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.srcObject = dest.stream;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      // Must await play() inside the user gesture for iOS
      try { await audioEl.play(); } catch (e) { console.warn('[voice] audio.play:', e); }
      playbackDestRef.current = dest;
      playbackElRef.current = audioEl;
    } catch (e) {
      console.warn('[voice] loudspeaker sink setup failed, fallback to ctx.destination:', e);
    }

    if (!ctx.audioWorklet) {
      throw new Error('AudioWorklet non supporté (iOS < 14.5 ou navigateur ancien)');
    }
    await ctx.audioWorklet.addModule('/audio-worklet.js');

    const micSource = ctx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(ctx, 'capture-processor');
    micSource.connect(workletNode);
    micSourceRef.current = micSource;
    workletNodeRef.current = workletNode;

    const wsUrl = `${WS_BASE}/ws/audio/${roomCode}/${currentPlayerId}`;
    console.log('[voice] opening ws:', wsUrl);
    const ws = new WebSocket(wsUrl);
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
    if (!micInitialized) {
      if (initializing) return;
      setInitializing(true);
      setVoiceError(null);
      try {
        await initAudio();
        setMicInitialized(true);
        setIsMuted(false);
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

    setIsMuted((prev) => {
      const next = !prev;
      try {
        const result = onSpeakToggle?.();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {}
      return next;
    });
  };

  const buttonDisabled = initializing;

  return (
    <Card className="darkoath-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center space-x-2" style={{ color: '#e8d9a8', fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>
          <span>🕯️</span>
          <span>VOCAL</span>
          <span>🕯️</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {gameState?.phase === 'CONSEIL_ROYAUME' && gameState?.conseil_royaume_start_time && (
          <ConseilTimer startTime={gameState.conseil_royaume_start_time} />
        )}

        <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(199, 168, 105, 0.1)', border: '1px solid rgba(199, 168, 105, 0.25)' }}>
          <p className="text-amber-200 text-sm">
            {micInitialized
              ? '🔊 Micro ouvert en continu — cliquez pour couper'
              : '🎙️ Appuyez pour entendre et parler avec les autres joueurs'}
          </p>
          {!micInitialized && (
            <p className="text-amber-100/70 text-xs mt-2 italic">
              📱 iPhone : désactivez le <strong>mode silencieux</strong> (petit bouton latéral) et montez le volume.
            </p>
          )}
        </div>

        {voiceError && (
          <div className="bg-red-900/70 border border-red-700 p-3 rounded-lg text-red-100 text-xs text-center break-words">
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
                : 'bg-amber-700 hover:bg-amber-600'
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
          <div className="p-3 rounded-lg" style={{ background: 'rgba(199, 168, 105, 0.08)', border: '1px solid rgba(199, 168, 105, 0.2)' }}>
            <h4 className="text-amber-300 font-medium mb-2 text-sm" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}>
              EN TRAIN DE PARLER
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
      </CardContent>
    </Card>
  );
};

export default ConseilRoyaumePanel;
