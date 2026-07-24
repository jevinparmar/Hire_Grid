import React, { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";

export function DashboardLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  const statusTexts = [
    "Establishing secure connection...",
    "Verifying authentication token...",
    "Synchronizing database schemas...",
    "Loading student modules and profiles...",
    "Initializing Command Center...",
  ];

  useEffect(() => {
    // Progress increment timer
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Random increment between 5 and 15
        const increment = Math.floor(Math.random() * 10) + 5;
        return Math.min(prev + increment, 100);
      });
    }, 100);

    // Text status transition timer
    const textInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusTexts.length);
    }, 400);

    return () => {
      clearInterval(progressInterval);
      clearInterval(textInterval);
    };
  }, []);

  useEffect(() => {
    if (progress === 100) {
      const timeout = setTimeout(() => {
        if (onComplete) onComplete();
      }, 300); // Small delay for final transition
      return () => clearTimeout(timeout);
    }
  }, [progress, onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#070D19] flex flex-col items-center justify-center select-none overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-75"></div>

      <div className="relative z-10 flex flex-col items-center space-y-8 max-w-md w-full px-6">
        {/* Pulsing Logo Orb */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-[#0C192E] to-[#08101E] border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 animate-bounce">
          <div className="absolute inset-0 rounded-3xl bg-emerald-500/5 animate-ping"></div>
          <ShieldCheck className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
        </div>

        {/* Title */}
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl font-black text-white tracking-widest uppercase">
            HIREGRID
          </h2>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
            Command Center
          </p>
        </div>

        {/* Loading Progress Bar Container */}
        <div className="w-full space-y-3">
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 rounded-full transition-all duration-100 ease-out shadow-[0_0_8px_rgba(52,211,153,0.3)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span className="animate-pulse">{statusTexts[statusIndex]}</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
