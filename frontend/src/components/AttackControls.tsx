"use client";

import React from "react";
import { AttackStatus } from "@/types/telemetry";
import { tacticalAudio } from "@/lib/audio";
import { tacticalVoice } from "@/lib/voice";
import { 
  Skull, 
  Compass, 
  RotateCcw, 
  Radio, 
  AlertTriangle, 
  ShieldCheck, 
  Flame, 
  Navigation,
  Wind,
  ShieldAlert
} from "lucide-react";

interface AttackControlsProps {
  attackStatus: AttackStatus | undefined;
  emergencyMode?: "PATROL" | "SCATTER" | "RTH";
  onTriggerAttack: (attackType: string, active: boolean, targetNode?: string) => Promise<void>;
  onTriggerEmergency?: (mode: "PATROL" | "SCATTER" | "RTH") => Promise<void>;
  onResetSwarm: () => Promise<void>;
  isLoading: boolean;
}

export const AttackControls: React.FC<AttackControlsProps> = ({
  attackStatus,
  emergencyMode = "PATROL",
  onTriggerAttack,
  onTriggerEmergency,
  onResetSwarm,
  isLoading,
}) => {
  const isGhostActive = attackStatus?.ghost_injection.active || false;
  const isDriftActive = attackStatus?.gps_drift.active || false;
  const isMeaconingActive = attackStatus?.meaconing.active || false;

  const handleGhostToggle = () => {
    tacticalAudio.playAlert();
    const next = !isGhostActive;
    if (next) {
      tacticalVoice.speak("Alert: Rogue phantom telemetry injection initiated.");
    }
    onTriggerAttack("ghost_injection", next);
  };

  const handleDriftToggle = () => {
    tacticalAudio.playAlert();
    const next = !isDriftActive;
    if (next) {
      tacticalVoice.speak("Warning: Electronic warfare GPS drift attack initiated against Node Gamma-3.");
    }
    onTriggerAttack("gps_drift", next, "Gamma-3");
  };

  const handleMeaconingToggle = () => {
    tacticalAudio.playAlert();
    const next = !isMeaconingActive;
    if (next) {
      tacticalVoice.speak("Warning: Meaconing replay telemetry detected on Node Beta-2.");
    }
    onTriggerAttack("meaconing", next, "Beta-2");
  };

  const handleScatter = () => {
    tacticalAudio.playAlert();
    tacticalVoice.speak("Emergency guidance override: Swarm scatter engaged. Dispersing formation radially.");
    if (onTriggerEmergency) {
      onTriggerEmergency("SCATTER");
    }
  };

  const handleRTH = () => {
    tacticalAudio.playAlert();
    tacticalVoice.speak("Emergency guidance override: Autonomous inertial return-to-base Alpha engaged.");
    if (onTriggerEmergency) {
      onTriggerEmergency("RTH");
    }
  };

  const handleResumePatrol = () => {
    tacticalAudio.playConsensusLock();
    tacticalVoice.speak("Resuming nominal formation patrol guidance.");
    if (onTriggerEmergency) {
      onTriggerEmergency("PATROL");
    }
  };

  const handleReset = () => {
    tacticalAudio.playConsensusLock();
    tacticalVoice.speak("Swarm sanitized. All nodes restored to nominal 100 percent consensus.");
    onResetSwarm();
  };

  return (
    <div className="rounded-xl obsidian-card p-4 border border-cyan-900/40 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-cyan-950/60 pb-2 gap-2">
        <div className="flex items-center space-x-2">
          <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
          <h2 className="text-sm font-bold text-slate-100 tracking-wider">
            ADVERSARIAL ATTACK INJECTION CONSOLE
          </h2>
        </div>
        <button
          onClick={handleReset}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-xs bg-slate-800/80 hover:bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded font-medium transition active:scale-95 disabled:opacity-50"
        >
          <RotateCcw className="w-3 h-3" />
          <span>RESTORE PRISTINE SWARM</span>
        </button>
      </div>

      {/* 3 Core Adversarial Attack Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Ghost Injection Attack */}
        <div
          className={`p-3 rounded-lg border transition duration-200 ${
            isGhostActive
              ? "obsidian-card-danger"
              : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Skull className={`w-4 h-4 ${isGhostActive ? "text-rose-400" : "text-slate-400"}`} />
              <span className="text-xs font-bold text-slate-200">GHOST INJECTION</span>
            </div>
            <button
              onClick={handleGhostToggle}
              disabled={isLoading}
              className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase transition active:scale-95 ${
                isGhostActive
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/50"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {isGhostActive ? "ACTIVE" : "INJECT"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Spawns rogue telemetry node (ICAO <code className="text-rose-300">0xA94F12</code>) without valid RF Time-of-Flight ranging.
          </p>
          <div className="mt-2 text-[10px] flex items-center justify-between text-slate-400 bg-black/40 px-2 py-1 rounded">
            <span>Target: Phantom Unit</span>
            <span className={isGhostActive ? "text-rose-400 font-bold" : "text-emerald-400"}>
              {isGhostActive ? "UWB Link: ZERO ACK" : "No Phantoms"}
            </span>
          </div>
        </div>

        {/* 2. GPS Drift Attack */}
        <div
          className={`p-3 rounded-lg border transition duration-200 ${
            isDriftActive
              ? "obsidian-card-danger"
              : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Compass className={`w-4 h-4 ${isDriftActive ? "text-rose-400 animate-spin" : "text-slate-400"}`} />
              <span className="text-xs font-bold text-slate-200">GPS DRIFT ATTACK</span>
            </div>
            <button
              onClick={handleDriftToggle}
              disabled={isLoading}
              className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase transition active:scale-95 ${
                isDriftActive
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/50"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {isDriftActive ? "DRIFTING" : "TRIGGER"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Skew Gamma-3 GPS coordinates up to <span className="text-rose-300">2.5 km</span> off-course. Triggers dead-reckoning recovery.
          </p>
          <div className="mt-2 text-[10px] flex items-center justify-between text-slate-400 bg-black/40 px-2 py-1 rounded">
            <span>Target: Gamma-3 (VIPER-03)</span>
            <span className={isDriftActive ? "text-rose-400 font-bold" : "text-emerald-400"}>
              {isDriftActive
                ? `Skew: +${attackStatus?.gps_drift.offset_meters?.toFixed(0) || 0}m`
                : "Synchronized (0m)"}
            </span>
          </div>
        </div>

        {/* 3. Meaconing / Replay Attack */}
        <div
          className={`p-3 rounded-lg border transition duration-200 ${
            isMeaconingActive
              ? "obsidian-card-warning"
              : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Radio className={`w-4 h-4 ${isMeaconingActive ? "text-amber-400 animate-pulse" : "text-slate-400"}`} />
              <span className="text-xs font-bold text-slate-200">MEACONING REPLAY</span>
            </div>
            <button
              onClick={handleMeaconingToggle}
              disabled={isLoading}
              className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase transition active:scale-95 ${
                isMeaconingActive
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-900/50"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {isMeaconingActive ? "REPLAYING" : "INJECT"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Replays valid coordinates out of phase to violate timestamp and sequence monotonicity invariants.
          </p>
          <div className="mt-2 text-[10px] flex items-center justify-between text-slate-400 bg-black/40 px-2 py-1 rounded">
            <span>Target: Beta-2 (VIPER-02)</span>
            <span className={isMeaconingActive ? "text-amber-400 font-bold" : "text-emerald-400"}>
              {isMeaconingActive ? "Lag: -6s Replay Frame" : "Real-time Stream"}
            </span>
          </div>
        </div>
      </div>

      {/* Emergency Guidance Controls (Extension 4: Scatter / RTH / Safe Land) */}
      <div className="bg-black/50 p-3 rounded-lg border border-amber-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
          <div>
            <span className="font-bold text-slate-200 tracking-wider">
              EMERGENCY AUTONOMOUS GUIDANCE OVERRIDE
            </span>
            <p className="text-[10px] text-slate-400">
              Trigger evasive scatter dispersal or return-to-home inertial vector to Base Alpha.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleScatter}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded font-bold transition flex items-center space-x-1.5 text-xs ${
              emergencyMode === "SCATTER"
                ? "bg-amber-600 text-black shadow-lg shadow-amber-900/50 ring-2 ring-amber-400"
                : "bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/60 text-amber-200"
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>ENGAGE SWARM SCATTER</span>
          </button>

          <button
            onClick={handleRTH}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded font-bold transition flex items-center space-x-1.5 text-xs ${
              emergencyMode === "RTH"
                ? "bg-cyan-600 text-black shadow-lg shadow-cyan-900/50 ring-2 ring-cyan-400"
                : "bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-600/60 text-cyan-200"
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>INERTIAL RTH (BASE ALPHA)</span>
          </button>

          {emergencyMode !== "PATROL" && (
            <button
              onClick={handleResumePatrol}
              disabled={isLoading}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
            >
              Resume Patrol
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
