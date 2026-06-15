'use client';

import { useLiveAPI } from '@/hooks/use-live-api';
import { Mic, MicOff, MonitorUp, Video, VideoOff, RefreshCcw, LogIn } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Orb } from '@/components/orb';
import { useAuth } from '@/lib/auth-context';

import { SpaceBackground } from '@/components/space-background';

export default function Home() {
  const { user, login, logout } = useAuth();
  
  const {
    connected,
    volume,
    error,
    videoMode,
    facingMode,
    videoElementRef,
    canvasRef,
    videoStream,
    connectAPI,
    disconnectAPI,
    toggleVideo,
    switchCamera
  } = useLiveAPI(user);

  let orbState: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';
  if (connected) {
    if (volume.output > 2) orbState = 'speaking';
    else if (volume.input > 2) orbState = 'listening';
    else orbState = 'thinking';
  }

  const triggerHaptic = (pattern: number | number[] = 50) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const handleToggleVideo = (mode: 'camera' | 'screen') => {
    triggerHaptic();
    toggleVideo(mode);
  };

  const handleSwitchCamera = () => {
    triggerHaptic(50);
    switchCamera();
  };

  const handleMicToggle = () => {
    triggerHaptic([50, 50]);
    if (connected) {
      disconnectAPI();
    } else {
      connectAPI();
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-transparent text-white flex flex-col items-center justify-center p-6 sm:p-8 font-sans selection:bg-red-900 overflow-hidden relative">
        <SpaceBackground />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="z-10 flex flex-col items-center text-center max-w-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            <div className="w-24 h-24 rounded-full border border-red-500/30 flex items-center justify-center bg-black shadow-[0_0_30px_rgba(239,68,68,0.2)] mb-8">
               <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/50 flex items-center justify-center">
                 <div className="w-8 h-8 rounded-full bg-red-500 animate-pulse" />
               </div>
            </div>
          </motion.div>
          <h1 className="text-3xl font-bold tracking-widest uppercase mb-4 text-red-500">NEXUS</h1>
          <p className="text-neutral-400 mb-12 font-mono text-sm leading-relaxed tracking-wide">
            Your friendly Malaysian AI companion with absolute recall mapping.
          </p>

          <button
            onClick={login}
            className="flex items-center gap-3 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-full transition-colors font-mono tracking-widest text-sm hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] focus:outline-none"
          >
            <LogIn size={18} />
            AUTHORIZE / LOGIN
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent text-white flex flex-col items-center justify-between p-6 sm:p-8 font-sans selection:bg-red-900 overflow-hidden relative">
      <SpaceBackground />
      <div className="absolute top-6 right-6 z-50">
        <button onClick={logout} className="text-neutral-500 hover:text-white font-mono text-xs tracking-widest uppercase transition-colors">
          Disconnect
        </button>
      </div>

      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          animate={{
             opacity: 0.3 + Math.min(Math.max(volume.output / 100, 0), 1) * 0.4 + Math.min(Math.max(volume.input / 100, 0), 1) * 0.2,
             scale: 1 + Math.min(Math.max(volume.output / 100, 0), 1) * 0.2 + Math.min(Math.max(volume.input / 100, 0), 1) * 0.1
          }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 100
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-900/20 blur-[120px] rounded-full" 
        />
      </div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl flex justify-between items-center z-10"
      >
        <div className="flex flex-col">
          <span className="text-red-500 font-mono text-sm tracking-widest uppercase font-bold">Blacktower™</span>
          <span className="text-xl font-medium tracking-tight">NEXUS Core</span>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.div 
            className="flex items-center space-x-2 bg-neutral-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-neutral-800 text-xs font-mono tracking-wider"
          >
            <div className={clsx("w-2 h-2 rounded-full", connected ? "bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.8)]" : "bg-neutral-600")} />
            <span className="text-neutral-300">{connected ? "LINK ESTABLISHED" : "OFFLINE"}</span>
          </motion.div>
        </div>
      </motion.header>

      {/* Main Interface */}
      <div className="flex-1 flex flex-col items-center justify-center w-full z-10 space-y-16">
        
        {/* Orb Container */}
        <div className="relative flex items-center justify-center">
          <Orb orbState={orbState} inputVolume={volume.input} outputVolume={volume.output} />
        </div>

        {/* Status Text / Error Text */}
        <div className="h-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-red-500 font-mono text-sm tracking-widest text-center px-4"
              >
                ERROR: {error}
              </motion.p>
            ) : (
              <motion.p
                key={orbState + connected}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-neutral-400 font-mono text-sm tracking-widest uppercase"
              >
                {!connected ? 'Awaiting Initialization...' 
                 : orbState === 'speaking' ? 'Transmitting...'
                 : orbState === 'listening' ? 'Receiving Audio...'
                 : orbState === 'thinking' ? 'Processing...'
                 : 'Idle'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hidden layout for video/canvas sharing to keep functionality active */}
      <div className="absolute opacity-0 pointer-events-none">
         <canvas ref={canvasRef} />
      </div>

      {/* PiP Video Preview */}
      <AnimatePresence>
        {videoStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-6 right-6 w-32 sm:w-48 aspect-[3/4] sm:aspect-video bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 z-50 flex items-center justify-center group"
          >
            <video 
              ref={videoElementRef} 
              autoPlay 
              playsInline 
              muted 
              className={clsx(
                "w-full h-full object-cover transition-transform duration-500",
                videoMode === 'camera' && facingMode === 'user' && "scale-x-[-1]"
              )}
            />
            {videoMode === 'camera' && (
              <button
                onClick={handleSwitchCamera}
                className="absolute right-2 top-2 bg-black/40 hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 p-2 rounded-full text-white backdrop-blur"
                title="Switch Camera"
              >
                 <RefreshCcw className="w-4 h-4" />
              </button>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur rounded text-[10px] font-mono text-neutral-300 uppercase tracking-widest pointer-events-none">
              {videoMode}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm flex items-center justify-center space-x-6 z-10 mb-8"
      >
        <button
          onClick={() => handleToggleVideo('camera')}
          disabled={!connected}
          className={clsx(
            "w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 backdrop-blur-md",
            !connected && "opacity-30 cursor-not-allowed",
            videoMode === 'camera'
              ? "bg-red-500/20 text-red-500 border border-red-500/50" 
              : "bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
          )}
          title="Toggle Camera"
        >
          <Video className="w-5 h-5" />
        </button>

        <button
          onClick={handleMicToggle}
          className={clsx(
            "w-20 h-20 flex flex-col items-center justify-center rounded-full transition-all duration-500 shadow-2xl relative",
            connected 
              ? "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_30px_rgba(220,38,38,0.3)]" 
              : "bg-white hover:bg-neutral-200 text-black shadow-white/10 hover:shadow-white/20"
          )}
        >
          {connected ? (
            <div className="flex flex-col items-center">
               <MicOff className="w-8 h-8 mb-1" />
            </div>
          ) : (
             <Mic className="w-8 h-8" />
          )}
        </button>
        
        <button
          onClick={() => handleToggleVideo('screen')}
          disabled={!connected}
          className={clsx(
            "w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 backdrop-blur-md",
            !connected && "opacity-30 cursor-not-allowed",
            videoMode === 'screen'
              ? "bg-red-500/20 text-red-500 border border-red-500/50" 
              : "bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
          )}
          title="Share Screen"
        >
          <MonitorUp className="w-5 h-5" />
        </button>
      </motion.div>
    </main>
  );
}
