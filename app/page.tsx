'use client';

import { useLiveAPI } from '@/hooks/use-live-api';
import { Mic, MicOff } from 'lucide-react';
import clsx from 'clsx';
import { Orb } from '@/components/orb';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, login } = useAuth();
  
  const {
    connected,
    isReconnecting,
    volume,
    micEnabled,
    connectAPI,
    disconnectAPI,
  } = useLiveAPI(user);

  const handleMicToggle = () => {
    if (connected || isReconnecting) {
      disconnectAPI();
    } else {
      connectAPI();
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center font-sans">
        <button onClick={login} className="text-white hover:text-red-500 uppercase tracking-widest text-xs border border-white/20 px-6 py-2 rounded-full">
            INITIALIZE
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans">
      <div className="relative mb-12">
         <Orb orbState={connected ? (volume.output>2?'speaking':volume.input>2?'listening':'thinking') : 'idle'} inputVolume={volume.input} outputVolume={volume.output} />
      </div>

      <button
        onClick={handleMicToggle}
        className={clsx(
          "w-16 h-16 flex items-center justify-center rounded-full transition-all duration-300 border",
          connected 
            ? "border-red-500 text-red-500" 
            : "border-white/20 text-white"
        )}
      >
        {connected ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
    </main>
  );
}
