"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Wifi, 
  WifiOff, 
  Clock, 
  Radio, 
  Cpu, 
  AlertOctagon, 
  Mic, 
  MicOff 
} from "lucide-react";
import { tacticalAudio } from "@/lib/audio";
import { tacticalVoice } from "@/lib/voice";

interface NavbarProps {
  isConnected: boolean;
  epoch: number;
  quarantinedCount: number;
  telemetrySource?: "MOCK" | "MAVLINK_SITL";
  emergencyMode?: "PATROL" | "SCATTER" | "RTH";
  mavlinkPacketCount?: number;
  onToggleSource?: (source: "MOCK" | "MAVLINK_SITL") => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  epoch,
  quarantinedCount,
  telemetrySource = "MOCK",
  emergencyMode = "PATROL",
  mavlinkPacketCount = 0,
  onToggleSource,
}) => {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [zuluTime, setZuluTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setZuluTime(now.toISOString().substring(11, 19) + "Z");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleAudio = () => {
    const nextState = !audioEnabled;
    tacticalAudio.enabled = nextState;
    setAudioEnabled(nextState);
    if (nextState) {
      tacticalAudio.playClick();
    }
  };

  const toggleVoice = () => {
    const nextVoice = !voiceEnabled;
    tacticalVoice.enabled = nextVoice;
    setVoiceEnabled(nextVoice);
    if (nextVoice) {
      tacticalVoice.speak("Tactical voice guidance enabled.");
    }
  };

  const isUnderAttack = quarantinedCount > 0;

  return (
    <header className="w-full obsidian-card border-b border-cyan-900/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      {/* Brand & Project Identity */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 shadow-md shadow-cyan-900/40">
          {isUnderAttack ? (
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          )}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-extrabold tracking-wider text-slate-100 uppercase">
              KINETIC<span className="text-cyan-400">MESH</span>
            </h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono">
              v1.0.4-PROD
            </span>
          </div>
          <p className="text-[10px] text-slate-400 tracking-wide font-sans">
            Zero-Trust Kinematic Swarm Consensus & Anti-Spoofing Mesh • Aviation Futures Challenge
          </p>
        </div>
      </div>

      {/* Operational Status Badges */}
      <div className="flex flex-wrap items-center space-x-2.5 font-mono text-xs">
        {/* DEFCON Status */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border ${
            isUnderAttack
              ? "bg-rose-950/80 border-rose-700/80 text-rose-300 animate-pulse"
              : "bg-emerald-950/70 border-emerald-700/60 text-emerald-300"
          }`}
        >
          <span className="text-[10px] font-bold">DEFCON</span>
          <span className="font-extrabold text-sm">{isUnderAttack ? "2 (THREAT)" : "4 (NORMAL)"}</span>
        </div>

        {/* Emergency Mode Tag (if active) */}
        {emergencyMode !== "PATROL" && (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/80 text-amber-200 animate-pulse">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">{emergencyMode === "SCATTER" ? "SWARM SCATTER" : "RTH BASE ALPHA"}</span>
          </div>
        )}

        {/* Telemetry Source Switcher (MOCK vs MAVLINK) */}
        <div className="flex items-center bg-black/60 rounded border border-cyan-800/40 p-0.5 text-[10px]">
          <button
            onClick={() => onToggleSource && onToggleSource("MOCK")}
            className={`px-2 py-0.5 rounded font-semibold transition ${
              telemetrySource === "MOCK"
                ? "bg-cyan-900/80 text-cyan-200 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            MOCK
          </button>
          <button
            onClick={() => onToggleSource && onToggleSource("MAVLINK_SITL")}
            className={`px-2 py-0.5 rounded font-semibold transition flex items-center space-x-1 ${
              telemetrySource === "MAVLINK_SITL"
                ? "bg-emerald-900/80 text-emerald-200 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="PX4/ArduPilot Gazebo SITL UDP:14550"
          >
            <Radio className="w-2.5 h-2.5" />
            <span>MAVLINK v2</span>
          </button>
        </div>

        {/* Live Zulu Time */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-black/40 border border-slate-800 text-slate-300 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{zuluTime || "00:00:00Z"}</span>
        </div>

        {/* Epoch / Cycle */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-black/40 border border-slate-800 text-slate-300 text-[11px]">
          <span className="text-slate-500">CYCLE:</span>
          <span className="text-cyan-300 font-bold">#{epoch}</span>
        </div>

        {/* WS Stream Status */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-black/40 border border-slate-800 text-[11px]">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">1Hz MESH</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="text-rose-400 font-medium">OFFLINE</span>
            </>
          )}
        </div>

        {/* Tactical Voice Synthesizer Toggle */}
        <button
          onClick={toggleVoice}
          className={`p-1.5 rounded transition border ${
            voiceEnabled
              ? "bg-cyan-950/80 border-cyan-700 text-cyan-300"
              : "bg-slate-900 border-slate-800 text-slate-600"
          }`}
          title={voiceEnabled ? "Tactical Voice Synthesizer On" : "Voice Alerts Muted"}
        >
          {voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        {/* Procedural Audio Effects Toggle */}
        <button
          onClick={toggleAudio}
          className={`p-1.5 rounded transition border ${
            audioEnabled
              ? "bg-cyan-950/80 border-cyan-700 text-cyan-300"
              : "bg-slate-900 border-slate-800 text-slate-600"
          }`}
          title={audioEnabled ? "Procedural Audio On" : "Muted"}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
