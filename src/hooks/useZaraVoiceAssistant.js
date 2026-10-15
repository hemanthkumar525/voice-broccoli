import { useCallback, useEffect, useRef, useState } from 'react';
import { GREETING_TEXTS, SUPPORTED_LANGUAGES } from '../common/zaraGreetings';

const DEFAULT_WS_URL =
  import.meta.env.VITE_ZARA_WS_URL ||
  'wss://15j2wt9hz1.execute-api.us-east-1.amazonaws.com/prod?token=DEV_BYPASS';

const DEFAULT_HTTP_URL =
  import.meta.env.VITE_ZARA_HTTP_URL ||
  'https://27hb2ougmyhprs3j5wpejfchb40vqraj.lambda-url.us-east-1.on.aws/';

/**
 * High-quality linear resampling from browser audio context sample rate to 16kHz
 */
function downsampleBuffer(buffer, sampleRate, outSampleRate = 16000) {
  if (sampleRate === outSampleRate) {
    return buffer;
  }
  const ratio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const originIndex = i * ratio;
    const indexFloor = Math.floor(originIndex);
    const indexCeil = Math.min(buffer.length - 1, indexFloor + 1);
    const frac = originIndex - indexFloor;
    result[i] = buffer[indexFloor] * (1 - frac) + buffer[indexCeil] * frac;
  }
  return result;
}

export function useZaraVoiceAssistant() {
  const [phase, setPhase] = useState('idle'); // idle | connecting | listening | speaking | ended | error
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('en'); // 'en' | 'ar' | 'hi'

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordCtxRef = useRef(null);
  const processorNodeRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const nextScheduledTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);

  const isZaraSpeakingRef = useRef(false);
  const audioEndTimeRef = useRef(0);
  const isUserSpeakingRef = useRef(false);
  const pcmChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const timeoutGuardRef = useRef(null);
  const selectedLangRef = useRef('en');
  const endedTimerRef = useRef(null);
  const playbackEndTimerRef = useRef(null);

  // Background noise filtration & adaptive VAD refs
  const noiseFloorRef = useRef(0.008);
  const speechFramesCountRef = useRef(0);
  const filterNodesRef = useRef([]);

  // Stop all active audio playback nodes immediately (Interruption & Language-shift support)
  const stopAllPlayback = useCallback(() => {
    try {
      clearTimeout(playbackEndTimerRef.current);
      activeSourcesRef.current.forEach((src) => {
        try {
          src.stop();
        } catch {}
      });
      activeSourcesRef.current = [];
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        nextScheduledTimeRef.current = playbackCtxRef.current.currentTime;
      }
    } catch {}
    isZaraSpeakingRef.current = false;
  }, []);

  // Play incremental 24kHz LPCM audio chunks from Amazon Nova 2 Sonic with strict sequential scheduling
  const playNova2SonicChunk = useCallback((base64Pcm24k) => {
    if (!base64Pcm24k) return;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioCtxClass();
      }
      if (playbackCtxRef.current.state === 'suspended') {
        playbackCtxRef.current.resume();
      }

      const rawBinary = atob(base64Pcm24k);
      const byteLen = rawBinary.length;
      const sampleCount = Math.floor(byteLen / 2);
      if (sampleCount === 0) return;

      const bytes = new Uint8Array(byteLen);
      for (let i = 0; i < byteLen; i++) {
        bytes[i] = rawBinary.charCodeAt(i);
      }

      // Convert 16-bit PCM little-endian samples using DataView (prevents alignment crashes and distortion)
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, byteLen);
      const float32Samples = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float32Samples[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      const audioBuffer = playbackCtxRef.current.createBuffer(1, float32Samples.length, 24000);
      audioBuffer.getChannelData(0).set(float32Samples);

      const sourceNode = playbackCtxRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;

      const gainNode = playbackCtxRef.current.createGain();
      gainNode.gain.value = 1.6; // Clear natural volume

      sourceNode.connect(gainNode);
      gainNode.connect(playbackCtxRef.current.destination);

      // Monotonically sequential scheduling: prevents chunks from overlapping or playing concurrently
      const currentTime = playbackCtxRef.current.currentTime;
      const scheduledTime = Math.max(currentTime + 0.02, nextScheduledTimeRef.current);
      sourceNode.start(scheduledTime);
      const chunkEndTime = scheduledTime + audioBuffer.duration;
      nextScheduledTimeRef.current = chunkEndTime;
      audioEndTimeRef.current = Math.max(audioEndTimeRef.current, chunkEndTime);

      activeSourcesRef.current.push(sourceNode);
      isZaraSpeakingRef.current = true;
      setPhase('speaking');

      sourceNode.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== sourceNode);
        if (activeSourcesRef.current.length === 0) {
          const remainingSec = Math.max(0, audioEndTimeRef.current - playbackCtxRef.current.currentTime);
          clearTimeout(playbackEndTimerRef.current);
          playbackEndTimerRef.current = setTimeout(() => {
            if (activeSourcesRef.current.length === 0) {
              isZaraSpeakingRef.current = false;
              pcmChunksRef.current = [];
              speechFramesCountRef.current = 0;
              setPhase('listening');
            }
          }, (remainingSec * 1000) + 250);
        }
      };
    } catch (err) {
      console.warn('[AUDIO] Failed to schedule playback chunk:', err);
    }
  }, []);

  // Cleanly terminate active session
  const endCall = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    clearTimeout(timeoutGuardRef.current);
    stopAllPlayback();

    // Stop microphone stream tracks
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch {}
      processorNodeRef.current = null;
    }

    if (filterNodesRef.current) {
      filterNodesRef.current.forEach((n) => {
        try {
          n.disconnect();
        } catch {}
      });
      filterNodesRef.current = [];
    }

    if (recordCtxRef.current) {
      try {
        recordCtxRef.current.close();
      } catch {}
      recordCtxRef.current = null;
    }

    if (playbackCtxRef.current) {
      try {
        playbackCtxRef.current.close();
      } catch {}
      playbackCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    pcmChunksRef.current = [];
    speechFramesCountRef.current = 0;
    isUserSpeakingRef.current = false;
    isZaraSpeakingRef.current = false;
    setPhase('ended');

    clearTimeout(endedTimerRef.current);
    endedTimerRef.current = setTimeout(() => {
      setPhase('idle');
    }, 1800);
  }, [stopAllPlayback]);

  // Transmit accumulated microphone PCM buffer to Nova 2 Sonic backend
  const flushAudioTurn = useCallback(async () => {
    if (pcmChunksRef.current.length === 0) return;

    // Calculate total byte length
    let totalLength = 0;
    for (const chunk of pcmChunksRef.current) {
      totalLength += chunk.length;
    }

    // Ignore short noise/coughs under 300ms (4800 samples @ 16kHz)
    if (totalLength < 4800) {
      pcmChunksRef.current = [];
      speechFramesCountRef.current = 0;
      isUserSpeakingRef.current = false;
      return;
    }

    // Assemble pure recorded speech PCM without bloated frontend silence
    // (Backend nova-sonic.js already appends exact required trailing silence for VAD)
    const mergedPcm = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of pcmChunksRef.current) {
      mergedPcm.set(chunk, offset);
      offset += chunk.length;
    }
    pcmChunksRef.current = [];
    isUserSpeakingRef.current = false;

    // Convert Int16 buffer to Base64
    const uint8Bytes = new Uint8Array(mergedPcm.buffer);
    let binary = '';
    for (let i = 0; i < uint8Bytes.byteLength; i++) {
      binary += String.fromCharCode(uint8Bytes[i]);
    }
    const base64Audio = btoa(binary);

    const langMapping = { hi: 'Hindi', ar: 'Arabic', en: 'English' };
    const targetLang = langMapping[selectedLangRef.current] || 'English';

    console.log(`[AUDIO] Transmitting ${mergedPcm.length} PCM samples (${targetLang}) to Nova 2 Sonic backend...`);
    setPhase('connecting');

    // Set safety timeout guard: reset to listening if no response within 15 seconds
    clearTimeout(timeoutGuardRef.current);
    timeoutGuardRef.current = setTimeout(() => {
      if (phase === 'connecting') {
        console.warn('[AUDIO] Turn response timed out, reverting to listening.');
        setPhase('listening');
      }
    }, 15000);

    // Primary delivery: API Gateway WebSocket with chunking to stay strictly under 32KB
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // If audio is under 22KB PCM (~29KB base64), send directly as a single audio_turn frame
      const SINGLE_TURN_MAX = 22000;
      if (uint8Bytes.byteLength <= SINGLE_TURN_MAX) {
        wsRef.current.send(
          JSON.stringify({
            action: 'audio_turn',
            audio: base64Audio,
            language: targetLang
          })
        );
      } else {
        // For longer speech, stream chunks with 45ms pacing so API Gateway routes to the same container
        const CHUNK_SIZE = 14000;
        for (let i = 0; i < uint8Bytes.byteLength; i += CHUNK_SIZE) {
          const slice = uint8Bytes.subarray(i, Math.min(i + CHUNK_SIZE, uint8Bytes.byteLength));
          let sliceBin = '';
          for (let j = 0; j < slice.length; j++) {
            sliceBin += String.fromCharCode(slice[j]);
          }
          wsRef.current.send(
            JSON.stringify({
              action: 'audio_chunk',
              audio: btoa(sliceBin)
            })
          );
          await new Promise((r) => setTimeout(r, 45));
        }
        await new Promise((r) => setTimeout(r, 45));
        wsRef.current.send(
          JSON.stringify({
            action: 'audio_end',
            language: targetLang
          })
        );
      }
    } else {
      // Fallback: Direct HTTP POST to Lambda Function URL
      try {
        const res = await fetch(DEFAULT_HTTP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'audio_turn',
            audio: base64Audio,
            language: targetLang
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.userText) {
            setTranscript((prev) => [...prev, { role: 'You', text: data.userText }].slice(-8));
          }
          if (data.text) {
            setTranscript((prev) => [...prev, { role: 'Zara', text: data.text }].slice(-8));
          }
          if (Array.isArray(data.audioChunks) && data.audioChunks.length > 0) {
            data.audioChunks.forEach((chunk) => playNova2SonicChunk(chunk));
          } else {
            setPhase('listening');
          }
        } else {
          setPhase('listening');
        }
      } catch (httpErr) {
        console.warn('[HTTP] Direct audio fallback error:', httpErr);
        setPhase('listening');
      }
    }
  }, [phase, playNova2SonicChunk]);

  // Set conversational language dynamically: shifts immediately without speaking first language
  const selectLanguage = useCallback(
    (langCode) => {
      // 1. Immediately cut off any ongoing playback from previous language
      stopAllPlayback();

      // 2. Normalize language code
      let code = 'en';
      let backendLang = 'English';
      if (langCode === 'hi' || langCode === 'hindi') {
        code = 'hi';
        backendLang = 'Hindi';
      } else if (langCode === 'ar' || langCode === 'arabic') {
        code = 'ar';
        backendLang = 'Arabic';
      }

      selectedLangRef.current = code;
      setCurrentLanguage(code);

      // 3. Update transcript to new language greeting text
      const greetingText = GREETING_TEXTS[code] || GREETING_TEXTS.en;
      setTranscript([{ role: 'Zara', text: greetingText }]);

      // 4. Notify backend to stream live greeting in new language from Amazon Nova 2 Sonic
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setPhase('connecting');
        wsRef.current.send(
          JSON.stringify({
            action: 'set_language',
            language: backendLang
          })
        );
      }
    },
    [stopAllPlayback]
  );

  // Initiate call: requests mic permission & starts 16kHz PCM audio capture
  const startCall = useCallback(async () => {
    setError('');
    setPhase('connecting');
    pcmChunksRef.current = [];
    isUserSpeakingRef.current = false;
    isZaraSpeakingRef.current = false;

    const initialLang = selectedLangRef.current || 'en';
    const langMapping = { hi: 'Hindi', ar: 'Arabic', en: 'English' };
    const backendLang = langMapping[initialLang] || 'English';

    // 1. Display greeting text
    const greetingText = GREETING_TEXTS[initialLang] || GREETING_TEXTS.en;
    setTranscript([{ role: 'Zara', text: greetingText }]);

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;

      // 2. Request microphone permission with full hardware noise suppression & echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true
        }
      });
      mediaStreamRef.current = stream;

      // 3. Unlock & resume audio playback context inside user gesture
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioCtxClass();
      }
      if (playbackCtxRef.current.state === 'suspended') {
        await playbackCtxRef.current.resume();
      }

      // 5. Setup Web Audio recording with vocal frequency bandpass filtering
      const recordCtx = new AudioCtxClass();
      recordCtxRef.current = recordCtx;
      if (recordCtx.state === 'suspended') {
        await recordCtx.resume();
      }

      const sourceNode = recordCtx.createMediaStreamSource(stream);

      // High-pass filter at 85 Hz (attenuates room HVAC rumble, desk thumps, handling noise)
      const highPass = recordCtx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 85;
      highPass.Q.value = 0.707;

      // Low-pass filter at 3800 Hz (attenuates high-frequency fan hiss, whistles, ambient clicks)
      const lowPass = recordCtx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3800;
      lowPass.Q.value = 0.707;

      filterNodesRef.current = [highPass, lowPass];

      const processor = recordCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        const rawInput = e.inputBuffer.getChannelData(0);
        const actualSampleRate = e.inputBuffer.sampleRate || recordCtx.sampleRate || 16000;
        const inputData = downsampleBuffer(rawInput, actualSampleRate, 16000);

        // Calculate RMS audio energy
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // 1. Acoustic Self-Voice Suppression:
        // While Zara is speaking out loud or during speaker reverberation hangover,
        // completely lock out microphone input.
        // Zara will NEVER listen to, transcribe, or be cut off by her own speaker voice!
        const currentPlaybackTime = playbackCtxRef.current ? playbackCtxRef.current.currentTime : 0;
        const isAudioPlaying = isZaraSpeakingRef.current || (currentPlaybackTime < audioEndTimeRef.current + 0.35);

        if (isAudioPlaying) {
          speechFramesCountRef.current = 0;
          return;
        }

        // 2. Dynamic Adaptive Noise Gate for Customer Speech
        const ambientNoise = noiseFloorRef.current;
        // Dynamic speech threshold scales with the room's noise floor (min 0.015)
        const speechThreshold = Math.max(0.015, ambientNoise * 2.6 + 0.007);

        if (rms > speechThreshold) {
          speechFramesCountRef.current++;

          // Require 2 consecutive frames (or ongoing turn) to confirm real speech, rejecting transient clicks/coughs
          if (speechFramesCountRef.current >= 2 || isUserSpeakingRef.current) {
            if (!isUserSpeakingRef.current) {
              console.log('[MIC] User speech detected (RMS:', rms.toFixed(4), 'Threshold:', speechThreshold.toFixed(4), ')');
            }

            isUserSpeakingRef.current = true;
            setPhase('listening');
            pcmChunksRef.current.push(pcm16);

            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              flushAudioTurn();
            }, 850);
          }
        } else {
          speechFramesCountRef.current = 0;

          if (isUserSpeakingRef.current) {
            // Collect trailing silence up to 850ms
            pcmChunksRef.current.push(pcm16);
          } else {
            // Continuously adapt and track ambient room noise floor during quiet periods
            noiseFloorRef.current = 0.95 * noiseFloorRef.current + 0.05 * rms;
          }
        }
      };

      // Connect audio through band-pass filter chain to processor
      sourceNode.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(processor);

      // Keep processor alive through a muted GainNode (zero feedback to speakers)
      const muteGain = recordCtx.createGain();
      muteGain.gain.value = 0;
      processor.connect(muteGain);
      muteGain.connect(recordCtx.destination);

      // 6. Connect to AWS API Gateway WebSocket
      const ws = new WebSocket(DEFAULT_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isZaraSpeakingRef.current) {
          setPhase('listening');
        }
        // Notify backend of session language
        ws.send(
          JSON.stringify({
            action: 'greet',
            language: backendLang
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status') {
            if (msg.status === 'thinking') {
              setPhase('connecting');
            } else if (msg.status === 'ready') {
              clearTimeout(timeoutGuardRef.current);
              setPhase('listening');
            }
          } else if (msg.type === 'audio_chunk') {
            // Incremental 24kHz audio from Amazon Nova 2 Sonic
            clearTimeout(timeoutGuardRef.current);
            playNova2SonicChunk(msg.data);
          } else if (msg.type === 'user_transcript') {
            // Live user speech transcription
            setTranscript((prev) => [...prev, { role: 'You', text: msg.text }].slice(-8));
          } else if (msg.type === 'transcript_chunk') {
            // Live assistant transcript streaming
            setTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'Zara') {
                return [...prev.slice(0, -1), { role: 'Zara', text: last.text + msg.text }].slice(-8);
              }
              return [...prev, { role: 'Zara', text: msg.text }].slice(-8);
            });
          } else if (msg.type === 'zara_response') {
            clearTimeout(timeoutGuardRef.current);
            setTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'Zara') {
                return [...prev.slice(0, -1), { role: 'Zara', text: msg.text }].slice(-8);
              }
              return [...prev, { role: 'Zara', text: msg.text }].slice(-8);
            });
            if (!msg.hasAudio && !isZaraSpeakingRef.current) {
              setPhase('listening');
            }
          } else if (msg.type === 'error') {
            clearTimeout(timeoutGuardRef.current);
            setError(msg.message || 'Error communicating with Zara');
            setPhase('error');
          }
        } catch (parseErr) {
          console.warn('[WEBSOCKET] Frame parse error:', parseErr);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeoutGuardRef.current);
        setError('Could not connect to Zara. Please check network connection.');
        setPhase('error');
      };

      ws.onclose = () => {
        clearTimeout(timeoutGuardRef.current);
        if (phase !== 'idle' && phase !== 'ended') {
          endCall();
        }
      };
    } catch (err) {
      console.error('[CALL] Initialization failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow microphone access to talk to Zara.');
      } else {
        setError('Audio initialization failed. Please check microphone connection.');
      }
      setPhase('error');
    }
  }, [endCall, flushAudioTurn, phase, playNova2SonicChunk, stopAllPlayback]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      clearTimeout(silenceTimerRef.current);
      clearTimeout(timeoutGuardRef.current);
      clearTimeout(endedTimerRef.current);
      clearTimeout(playbackEndTimerRef.current);
      stopAllPlayback();
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch {}
      }
      if (filterNodesRef.current) {
        filterNodesRef.current.forEach((n) => {
          try {
            n.disconnect();
          } catch {}
        });
        filterNodesRef.current = [];
      }
      if (recordCtxRef.current) {
        try {
          recordCtxRef.current.close();
        } catch {}
      }
      if (playbackCtxRef.current) {
        try {
          playbackCtxRef.current.close();
        } catch {}
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, [stopAllPlayback]);

  return {
    phase,
    error,
    transcript,
    currentLanguage,
    selectLanguage,
    startCall,
    endCall
  };
}

export default useZaraVoiceAssistant;
