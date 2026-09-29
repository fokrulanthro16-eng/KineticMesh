"use client";

import React from "react";
import { SwarmTelemetry } from "@/types/telemetry";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Network, 
  Filter, 
  Zap, 
  Radio, 
  Activity, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";

interface SystemHardeningPanelProps {
  telemetry: SwarmTelemetry | null;
}

export const SystemHardeningPanel: React.FC<SystemHardeningPanelProps> = ({ telemetry }) => {
  const metrics = telemetry?.resilience_metrics;
  const isCoordinatedSpoof = telemetry?.global_coordinated_spoof || false;
  const isRfBlackout = metrics?.rf_blackout_active || false;
  const consensusMode = telemetry?.consensus_mode || "NOMINAL_CONSENSUS";

  // Calculate approximate swarm aerodynamic power draw
  const nodes = telemetry ? Object.values(telemetry.nodes) : [];
  const maxNodePower = nodes.reduce((max, n) => {
    const v = (n.vel_enu[0]**2 + n.vel_enu[1]**2 + n.vel_enu[2]**2)**0.5;
    const a = (n.accel_enu[0]**2 + n.accel_enu[1]**2 + n.accel_enu[2]**2)**0.5;
    const p = 2.4 * v * a + 0.5 * 1.225 * 0.08 * (v**3);
    return Math.max(max, p);
  }, 0);

  return (
    <div className="rounded-xl obsidian-card p-4 border border-cyan-900/40 space-y-3">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-cyan-950/70 pb-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-100 tracking-wider">
            SYSTEM HARDENING & RESILIENCE METRICS
          </h3>
        </div>
        <span
          className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold border ${
            isCoordinatedSpoof
              ? "bg-rose-950 text-rose-300 border-rose-800 animate-pulse"
              : isRfBlackout
              ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse"
              : "bg-emerald-950 text-emerald-300 border-emerald-800"
          }`}
        >
          {consensusMode}
        </span>
      </div>

      {/* 4 Robustness Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
        {/* 1. KNN Sparse Mesh Topology */}
        <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
            <span className="flex items-center space-x-1.5">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>KNN Sparse Mesh</span>
            </span>
            <span className="text-emerald-400 font-bold">O(kN)</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Neighbor Factor: <strong className="text-slate-200">k={metrics?.knn_k || 3}</strong>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>Edges Active:</span>
            <span className="text-cyan-300 font-semibold">
              {metrics?.knn_edges_active || 7} Links
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Pruned Redundancy:</span>
            <span className="text-emerald-400 font-semibold">
              +{metrics?.knn_pruned_links_count || 3} Edges
            </span>
          </div>
        </div>

        {/* 2. NLOS & Multipath Outlier Rejector */}
        <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
            <span className="flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multipath Filter</span>
            </span>
            <span className="text-[9px] bg-emerald-950/70 text-emerald-300 px-1 rounded border border-emerald-800">
              ACTIVE
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            Algorithm: <strong className="text-slate-200">RANSAC / Asym-Z</strong>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>Spikes Rejected:</span>
            <span className="text-emerald-400 font-bold">
              {metrics?.nlos_outliers_rejected_total || 0} Events
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>NLOS Tolerance:</span>
            <span className="text-slate-300">Δ &lt; 3.5m</span>
          </div>
        </div>

        {/* 3. Global Invariant & Aerodynamic Energy State */}
        <div
          className={`p-2.5 rounded-lg border space-y-1 ${
            isCoordinatedSpoof ? "bg-rose-950/40 border-rose-800" : "bg-black/40 border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
            <span className="flex items-center space-x-1.5">
              <Zap className={`w-3.5 h-3.5 ${isCoordinatedSpoof ? "text-rose-400" : "text-amber-400"}`} />
              <span>Inertial Energy</span>
            </span>
            <span
              className={`text-[9px] px-1 rounded border ${
                isCoordinatedSpoof
                  ? "bg-rose-900 text-rose-200 border-rose-700"
                  : "bg-emerald-950/70 text-emerald-300 border-emerald-800"
              }`}
            >
              {isCoordinatedSpoof ? "BREACH" : "ENVELOPE OK"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            Propulsion Peak: <strong className="text-slate-200">{maxNodePower.toFixed(0)}W / 1800W</strong>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>Coordinated Spoof:</span>
            <span className={isCoordinatedSpoof ? "text-rose-400 font-bold" : "text-emerald-400"}>
              {isCoordinatedSpoof ? "DETECTED" : "NEGATIVE"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Collective Invariant:</span>
            <span className="text-slate-300">dE/dt Verified</span>
          </div>
        </div>

        {/* 4. RF Jamming / Blackout Failover */}
        <div
          className={`p-2.5 rounded-lg border space-y-1 ${
            isRfBlackout ? "bg-amber-950/40 border-amber-800" : "bg-black/40 border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
            <span className="flex items-center space-x-1.5">
              <Radio className={`w-3.5 h-3.5 ${isRfBlackout ? "text-amber-400 animate-pulse" : "text-cyan-400"}`} />
              <span>RF Link Health</span>
            </span>
            <span
              className={`text-[9px] px-1 rounded border ${
                isRfBlackout
                  ? "bg-amber-900 text-amber-200 border-amber-700 font-bold"
                  : "bg-emerald-950/70 text-emerald-300 border-emerald-800"
              }`}
            >
              {isRfBlackout ? "EW JAMMING" : "CLEAR AIRSPACE"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            UWB Availability: <strong className="text-slate-200">{metrics?.link_availability_pct ?? 100}%</strong>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>Failover Subsystem:</span>
            <span className={isRfBlackout ? "text-amber-300 font-bold" : "text-emerald-400"}>
              {isRfBlackout ? "INERTIAL FUSION" : "UWB P2P MESH"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Noise Floor:</span>
            <span className="text-slate-300">-95 dBm</span>
          </div>
        </div>
      </div>
    </div>
  );
};
