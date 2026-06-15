'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

export function SpaceBackground() {
  const [isReady, setIsReady] = useState(false);
  const [isDay, setIsDay] = useState(false);
  
  const [stars, setStars] = useState<{ id: number; w: string; h: string; top: string; left: string; dur: number; delay: number }[]>([]);
  const [particles, setParticles] = useState<{ id: number; w: string; h: string; top: string; left: string; x: number; y: number; dur: number }[]>([]);

  useEffect(() => {
    // Generate stars and particles on mount
    const newStars = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      w: Math.random() * 2 + 1 + 'px',
      h: Math.random() * 2 + 1 + 'px',
      top: Math.random() * 100 + '%',
      left: Math.random() * 100 + '%',
      dur: Math.random() * 3 + 4,
      delay: Math.random() * 5,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStars(newStars);

    const newParticles = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      w: Math.random() * 200 + 50 + 'px',
      h: Math.random() * 200 + 50 + 'px',
      top: Math.random() * 100 + '%',
      left: Math.random() * 100 + '%',
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      dur: Math.random() * 20 + 20,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticles(newParticles);

    const updateTime = () => {
      const now = new Date();
      // Format time to Asia/Kuala_Lumpur, get just the hour
      const klTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur", hour12: false, hour: 'numeric' });
      const hour = parseInt(klTimeStr, 10);
      setIsDay(hour >= 6 && hour < 19);
      setIsReady(true);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  if (!isReady) return <div className="absolute inset-0 bg-black pointer-events-none" />;

  return (
    <div className={clsx(
      "absolute inset-0 pointer-events-none overflow-hidden transition-colors duration-[3000ms] ease-in-out",
      isDay ? "bg-indigo-950" : "bg-black"
    )}>
      {/* Stars Background */}
      <div className="absolute inset-0 opacity-50">
        {stars.map((s) => (
          <motion.div
            key={`star-${s.id}`}
            className="absolute rounded-full bg-white"
            style={{
              width: s.w,
              height: s.h,
              top: s.top,
              left: s.left,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.1, 0.8, 0.1],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: s.dur,
              repeat: Infinity,
              ease: "easeInOut",
              delay: s.delay,
            }}
          />
        ))}
      </div>

      {/* Floating Particles to feel like space */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <motion.div
            key={`particle-${p.id}`}
            className="absolute bg-white/5 rounded-full blur-xl"
            style={{
              width: p.w,
              height: p.h,
              top: p.top,
              left: p.left,
            }}
            animate={{
              x: [0, p.x, 0],
              y: [0, p.y, 0],
            }}
            transition={{
              duration: p.dur,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Celestial Body: Sun or Moon */}
      {isDay ? (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 2 }}
          className="absolute top-[10%] right-[15%] w-32 h-32 rounded-full bg-gradient-to-tr from-yellow-500 to-orange-300 blur-[2px] shadow-[0_0_100px_rgba(250,204,21,0.5)] flex items-center justify-center"
        >
          <div className="w-full h-full rounded-full bg-yellow-100 opacity-60 animate-pulse" />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 2 }}
          className="absolute top-[15%] left-[20%] w-24 h-24 rounded-full bg-slate-200 shadow-[0_0_80px_rgba(226,232,240,0.3)] shadow-inner overflow-hidden"
        >
           {/* Moon Craters */}
           <div className="absolute top-[20%] left-[20%] w-4 h-4 rounded-full bg-slate-300/50" />
           <div className="absolute top-[50%] right-[30%] w-6 h-6 rounded-full bg-slate-300/40" />
           <div className="absolute bottom-[30%] left-[40%] w-5 h-5 rounded-full bg-slate-300/30" />
        </motion.div>
      )}

    </div>
  );
}
