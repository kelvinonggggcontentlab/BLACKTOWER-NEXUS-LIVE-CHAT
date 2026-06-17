'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';

export function useLiveAPI(user?: User | null) {
  const [connected, setConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [videoMode, setVideoMode] = useState<'camera' | 'screen' | 'none'>('none');
  
  const [volume, setVolume] = useState<{ input: number, output: number }>({ input: 0, output: 0 });
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [voice, setVoice] = useState('Enceladus');
  const [speed, setSpeed] = useState(1);
  
  // Context tags to show what NEXUS is using
  const [contextTags, setContextTags] = useState<{ id: string; type: 'email' | 'doc'; label: string }[]>([]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeIntervalRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sendFramesIntervalRef = useRef<any>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextStartTimeRef = useRef<number>(0);

  const isAutoReconnectEnabledRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<any>(null);

  const bufferToPCM = (buffer: Float32Array) => {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      // @ts-ignore
      buf[l] = Math.min(1, buffer[l]) * 0x7fff;
    }
    return Buffer.from(buf.buffer).toString('base64');
  };

  const playAudioChunk = (audioCtx: AudioContext, base64Audio: string) => {
    const binaryStr = atob(base64Audio);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    // The Live API outputs 24kHz 16-bit little-endian PCM
    const view = new DataView(bytes.buffer);
    const floats = new Float32Array(bytes.length / 2);
    for (let i = 0; i < floats.length; i++) {
        floats[i] = view.getInt16(i * 2, true) / 32768; // true for little endpoint
    }
    
    const buffer = audioCtx.createBuffer(1, floats.length, 24000);
    buffer.getChannelData(0).set(floats);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    if (outputAnalyserRef.current) {
        source.connect(outputAnalyserRef.current);
        outputAnalyserRef.current.connect(audioCtx.destination);
    } else {
        source.connect(audioCtx.destination);
    }
    
    const currentTime = audioCtx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const connectAPI = async (isReconnect = false) => {
    isAutoReconnectEnabledRef.current = true;
    if (!isReconnect) {
      reconnectAttemptsRef.current = 0;
      setError(null);
    } else {
      setIsReconnecting(true);
    }

    let memories: any[] = [];
    if (user) {
      try {
        const q = query(collection(db, `users/${user.uid}/memories`), orderBy('createdAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        memories = snapshot.docs.map(doc => doc.data());
      } catch (err) {
        console.error("Failed to fetch memories", err);
      }
    }

    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/live`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      reconnectAttemptsRef.current = 0;
      setIsReconnecting(false);
      // Send init with memories
      ws.send(JSON.stringify({ type: 'init', uid: user?.uid, memories, voice, speed }));
      
      setConnected(true);
      // Initialize Audio
      try {
        const _inputAudioCtx = new AudioContext({ sampleRate: 16000 });
        inputAudioCtxRef.current = _inputAudioCtx;
        
        const _outputAudioCtx = new AudioContext({ sampleRate: 24000 });
        outputAudioCtxRef.current = _outputAudioCtx;

        // Analysers
        const inAnalyser = _inputAudioCtx.createAnalyser();
        inAnalyser.fftSize = 512;
        inputAnalyserRef.current = inAnalyser;

        const outAnalyser = _outputAudioCtx.createAnalyser();
        outAnalyser.fftSize = 512;
        outputAnalyserRef.current = outAnalyser;

        // Start volume monitoring
        volumeIntervalRef.current = setInterval(() => {
          let inVol = 0;
          let outVol = 0;
          if (inputAnalyserRef.current) {
            const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
            inputAnalyserRef.current.getByteFrequencyData(data);
            const sum = data.reduce((a, b) => a + b, 0);
            inVol = sum / data.length;
          }
          if (outputAnalyserRef.current) {
            const data = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
            outputAnalyserRef.current.getByteFrequencyData(data);
            const sum = data.reduce((a, b) => a + b, 0);
            outVol = sum / data.length;
          }
          setVolume({ input: inVol, output: outVol });
        }, 50);

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          
          const source = _inputAudioCtx.createMediaStreamSource(stream);
          const processor = _inputAudioCtx.createScriptProcessor(4096, 1, 1);
          source.connect(inAnalyser);
          source.connect(processor);
          processor.connect(_inputAudioCtx.destination);
  
          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN || !micEnabled) return;
            const float32Array = e.inputBuffer.getChannelData(0);
            
            // Helper instead of Buffer in browser:
            let pcm16 = new Int16Array(float32Array.length);
            for (let i = 0; i < float32Array.length; i++) {
              let s = Math.max(-1, Math.min(1, float32Array[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // btoa array buffer
            let binary = '';
            const bytes = new Uint8Array(pcm16.buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = window.btoa(binary);
            
            ws.send(JSON.stringify({ audio: base64 }));
          };
          setMicEnabled(true);
          setError(null);
        } catch (err: any) {
          console.warn('Microphone access denied or not available, proceeding without input audio:', err);
          setMicEnabled(false);
          // Do not set error here to avoid UI crash, just disable mic
        }
      } catch (err: any) {
        console.error('Audio setup failed:', err);
        setError('Audio setup failed: ' + (err.message || 'Unknown error'));
        setConnected(false);
        ws.close();
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setError("WebSocket connection error");
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'text') {
            setTranscript(prev => [...prev, { role: 'model', content: msg.text }]);
        }

        if (msg.type === 'tool_call' && msg.name === 'save_memory') {
          if (user && msg.fact) {
             try {
                await addDoc(collection(db, `users/${user.uid}/memories`), {
                  userId: user.uid,
                  fact: msg.fact,
                  createdAt: serverTimestamp()
                });
                ws.send(JSON.stringify({ type: 'tool_response', id: msg.id, name: msg.name, response: { success: true } }));
             } catch (e) {
                console.error("Failed handling tool call", e);
                ws.send(JSON.stringify({ type: 'tool_response', id: msg.id, name: msg.name, response: { error: String(e) } }));
             }
          } else {
             ws.send(JSON.stringify({ type: 'tool_response', id: msg.id, name: msg.name, response: { error: "Not logged in" } }));
          }
        }
        if (msg.audio && outputAudioCtxRef.current) {
          playAudioChunk(outputAudioCtxRef.current, msg.audio);
        }
        if (msg.interrupted) {
          if (outputAudioCtxRef.current) {
             outputAudioCtxRef.current.close().then(() => {
                 const newCtx = new AudioContext({ sampleRate: 24000 });
                 outputAudioCtxRef.current = newCtx;
                 nextStartTimeRef.current = newCtx.currentTime;
             });
          }
        }
      } catch (err) { }
    };

    ws.onclose = () => {
      setConnected(false);
      if (isAutoReconnectEnabledRef.current) {
        setIsReconnecting(true);
        if (wsRef.current === ws) wsRef.current = null;
        if (inputAudioCtxRef.current) { inputAudioCtxRef.current.close(); inputAudioCtxRef.current = null; }
        if (outputAudioCtxRef.current) { outputAudioCtxRef.current.close(); outputAudioCtxRef.current = null; }
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
        
        const delay = Math.min(10000, 1000 * (reconnectAttemptsRef.current + 1));
        reconnectAttemptsRef.current++;
        console.log(`Connection lost. Reconnecting in ${delay}ms (Attempt ${reconnectAttemptsRef.current})...`);
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
           if (isAutoReconnectEnabledRef.current) {
              connectAPI(true);
           }
        }, delay);
      } else {
        setIsReconnecting(false);
        disconnectAPI();
      }
    };
  };

  const disconnectAPI = () => {
    isAutoReconnectEnabledRef.current = false;
    setIsReconnecting(false);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }
    if (sendFramesIntervalRef.current) {
      clearInterval(sendFramesIntervalRef.current);
      sendFramesIntervalRef.current = null;
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    setVolume({ input: 0, output: 0 });
    setConnected(false);
    setVideoMode('none');
  };

  const switchCamera = async () => {
    if (videoMode !== 'camera') return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    
    // Stop current track
    if (videoStream) {
       videoStream.getTracks().forEach(t => t.stop());
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720, facingMode: nextMode } 
      });
      setVideoStream(stream);
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
      }
    } catch(e) {
      console.error(e)
    }
  };

  const toggleVideo = async (mode: 'camera' | 'screen') => {
    if (videoStream) {
       videoStream.getTracks().forEach(t => t.stop());
       setVideoStream(null);
       if (videoMode === mode) {
           setVideoMode('none');
           if (sendFramesIntervalRef.current) clearInterval(sendFramesIntervalRef.current);
           return;
       }
    }
    
    try {
      let stream: MediaStream;
      if (mode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode } });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720 } });
      }
      setVideoStream(stream);
      setVideoMode(mode);

      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
      }
      
      if (sendFramesIntervalRef.current) {
         clearInterval(sendFramesIntervalRef.current);
      }
      
      // Sending frame every ~1s (1 fps limit)
      sendFramesIntervalRef.current = setInterval(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const video = videoElementRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
               ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
               const base64DataUrl = canvas.toDataURL('image/jpeg', 0.8);
               const base64Str = base64DataUrl.split(',')[1];
               wsRef.current.send(JSON.stringify({ video: base64Str, mimeType: 'image/jpeg' }));
            }
        }
      }, 1000);
      
    } catch (e) {
      console.error("Video error:", e);
      setVideoMode('none');
    }
  };

  return {
    connected,
    isReconnecting,
    volume,
    error,
    micEnabled,
    transcript,
    voice,
    speed,
    setVoice,
    setSpeed,
    contextTags, // Expose contextTags
    videoMode,
    facingMode,
    videoElementRef,
    canvasRef,
    videoStream,
    connectAPI,
    disconnectAPI,
    toggleVideo,
    switchCamera
  };
}
