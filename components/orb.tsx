import { motion } from 'motion/react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import Image from 'next/image';

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface OrbProps {
  orbState: OrbState;
  inputVolume: number;
  outputVolume: number;
}

export function Orb({ orbState, inputVolume, outputVolume }: OrbProps) {
  // Normalize volumes for animation scaling
  const normInput = Math.min(Math.max(inputVolume / 100, 0), 1);
  const normOutput = Math.min(Math.max(outputVolume / 100, 0), 1);
  
  const scale = orbState === 'speaking' ? 1 + normOutput * 0.3 
              : orbState === 'listening' ? 1 + normInput * 0.2
              : 1;

  const ringScale = orbState === 'speaking' ? 1.2 + normOutput * 0.8
                  : orbState === 'listening' ? 1.1 + normInput * 0.4
                  : orbState === 'thinking' ? 1.15
                  : 1;

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer Energy Rings */}
      <motion.div
        animate={{
          scale: ringScale,
          opacity: orbState === 'idle' ? 0.3 : orbState === 'thinking' ? 0.6 : 0.8,
          rotate: orbState === 'thinking' ? 360 : 0,
        }}
        transition={{
          rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
          scale: { type: 'spring', damping: 15, stiffness: 100 },
        }}
        className={clsx(
          "absolute inset-[-40px] rounded-full blur-xl transition-colors duration-500",
          orbState === 'thinking' ? "bg-red-500/20" : "bg-red-600/30",
          orbState === 'speaking' ? "scale-125 bg-red-500/40" : ""
        )}
      />
      
      {/* Second Ring */}
      <motion.div
        animate={{
          scale: ringScale * 0.9,
          opacity: orbState === 'idle' ? 0.4 : 0.7,
        }}
        transition={{
          scale: { type: 'spring', damping: 20, stiffness: 120 },
        }}
        className="absolute inset-[0px] rounded-full border border-red-500/30"
      />

      {/* Internal particles simulation via rotating gradients */}
      {orbState === 'thinking' && (
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-4 rounded-full border-t-2 border-red-500/50 transparent blur-sm"
        />
      )}

      {/* Main Orb Image */}
      <motion.div
        animate={{ 
          scale: scale,
          y: orbState === 'idle' ? [0, -10, 0] : 0,
          boxShadow: orbState === 'speaking' ? `0 0 ${40 + normOutput*60}px rgba(220, 38, 38, 0.8)` 
                   : orbState === 'listening' ? `0 0 ${20 + normInput*40}px rgba(220, 38, 38, 0.6)`
                   : orbState === 'thinking' ? '0 0 30px rgba(220, 38, 38, 0.5)'
                   : '0 0 20px rgba(220, 38, 38, 0.3)'
        }}
        transition={{
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          scale: { type: 'spring', damping: 10, stiffness: 100 }
        }}
        className="relative z-10 w-full h-full rounded-full bg-[#0a0a0a] overflow-hidden flex items-center justify-center border border-red-900/50"
      >
        {/* Placeholder styling to look like a dark premium orb just in case image is missing */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)] rounded-full mix-blend-overlay" />
        
        {/* Actual Image if uploaded */}
        <Image 
           src="/orb.png" 
           alt="BLACKTOWER NEXUS Orb" 
           fill
           sizes="256px"
           className="object-contain p-2 mix-blend-lighten pointer-events-none"
           onError={(e) => {
             // fallback to generic style if not found
             (e.target as HTMLElement).style.display = 'none';
           }}
        />

        {/* Dynamic Glow Overlay inside orb */}
        <motion.div 
           animate={{
              opacity: orbState === 'speaking' ? 0.3 + normOutput*0.5 
                     : orbState === 'listening' ? 0.2 + normInput*0.4 
                     : 0.1
           }}
           className="absolute inset-0 bg-red-500 rounded-full mix-blend-overlay"
        />
      </motion.div>
    </div>
  );
}
