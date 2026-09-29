"use client";

import React from "react";
import { SwarmTelemetry, SwarmNode } from "@/types/telemetry";
import { Activity, ShieldAlert, Gauge, Compass, AlertTriangle, CheckCircle } from "lucide-react";

interface TelemetryHUDProps {
  telemetry: SwarmTelemetry | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  selectedNodeId,
  onSelectNode,
}) => {
  if (!telemetry) return null;

  const nodes = Object.values(telemetry.nodes);
  const maxResidual = Math.max(
    ...nodes.map((n) => n.spatial_residual_m || 0),
    30.0
  );

  return (
    <div className="space-y-4">
      {/* Node Trust Matrix Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.node_id;
          const isCompromised = node.is_compromised;
          const isGhost = node.is_ghost;

          let cardStyle = "border-slate-800 bg-slate-900/40 hover:border-cyan-800/60";
          let badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-800";
          let statusText = "NOMINAL";

          if (isGhost) {
            cardStyle = "border-rose-800/80 bg-rose-950/20";
            badgeColor = "bg-rose-950 text-rose-300 border-rose-800";
            statusText = "GHOST PHANTOM";
          } else if (isCompromised) {
            cardStyle = "border-amber-600/80 bg-amber-950/30";
            badgeColor = "bg-amber-950 text-amber-300 border-amber-800";
            statusText = "FALLOVER ACTIVE";
          }

          if (isSelected) {
            cardStyle += " ring-2 ring-cyan-400";
          }

          return (
            <div
              key={node.node_id}
              onClick={() => onSelectNode(isSelected ? null : node.node_id)}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all duration-150 obsidian-card ${cardStyle}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-200">{node.node_id}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${badgeColor}`}>
                  {statusText}
                </span>
              </div>

              {/* Trust Score Meter */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Trust Score</span>
                  <span
                    className={`font-mono font-bold ${
                      node.trust_score < 50
                        ? "text-rose-400"
                        : node.trust_score < 80
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {node.trust_score.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      node.trust_score < 50
                        ? "bg-rose-500"
                        : node.trust_score < 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.max(node.trust_score, 4)}%` }}
                  />
                </div>
              </div>

              {/* Spatial Residual ε */}
              <div className="mt-2 text-[10px] flex items-center justify-between text-slate-400">
                <span>Ranging Residual:</span>
                <span
                  className={`font-mono ${
                    node.spatial_residual_m > 15
                      ? "text-rose-400 font-bold"
                      : "text-slate-300"
                  }`}
                >
                  ε = {node.spatial_residual_m.toFixed(1)}m
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Residuals & Kinematics Graphs Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Graph 1: Peer Distance Residuals vs Consensus Threshold */}
        <div className="rounded-xl obsidian-card p-3 border border-cyan-900/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200">
                PEER DISTANCE RESIDUALS (MDS TOLERANCE ε)
              </h3>
            </div>
            <span className="text-[10px] text-rose-400 font-mono">
              THRESHOLD LIMIT: ε = 15.0m
            </span>
          </div>

          {/* SVG Bar Chart for Residuals */}
          <div className="h-32 w-full pt-2">
            <div className="relative h-24 flex items-end justify-around border-b border-slate-700/80 px-4">
              {/* 15m Threshold dashed guide line */}
              <div
                className="absolute left-0 right-0 border-b border-dashed border-rose-500/70 z-10 flex items-center justify-end pr-2 pointer-events-none"
                style={{
                  bottom: `${Math.min(100, (15.0 / Math.max(maxResidual, 30)) * 100)}%`,
                }}
              >
                <span className="text-[9px] bg-rose-950/80 text-rose-300 px-1 rounded -translate-y-2">
                  ε = 15m QUARANTINE LIMIT
                </span>
              </div>

              {nodes.map((node) => {
                const res = node.spatial_residual_m || 0;
                const heightPct = Math.min(100, Math.max(6, (res / Math.max(maxResidual, 30)) * 100));
                const isOverThreshold = res > 15.0;

                return (
                  <div key={node.node_id} className="flex flex-col items-center flex-1 max-w-[50px] group">
                    <span
                      className={`text-[9px] font-mono mb-1 ${
                        isOverThreshold ? "text-rose-400 font-bold animate-pulse" : "text-slate-400"
                      }`}
                    >
                      {res > 999 ? `${(res / 1000).toFixed(1)}k` : `${res.toFixed(1)}m`}
                    </span>
                    <div
                      className={`w-5 rounded-t transition-all duration-300 ${
                        isOverThreshold
                          ? "bg-gradient-to-t from-rose-700 to-rose-400 shadow-lg shadow-rose-900/60"
                          : "bg-gradient-to-t from-emerald-800 to-emerald-400"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] font-mono text-slate-300 mt-1 truncate">
                      {node.node_id.replace("VIPER-", "")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 mt-1 px-2">
              <span>0m (Perfect Geometry)</span>
              <span>Scaled Max: {maxResidual.toFixed(0)}m</span>
            </div>
          </div>
        </div>

        {/* Graph 2: Kinematic Invariant Integrity (Velocity & Altitude Decoupling) */}
        <div className="rounded-xl obsidian-card p-3 border border-cyan-900/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200">
                KINEMATIC INVARIANT MONITOR (TELEPORTATION & BARO)
              </h3>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">
              VELOCITY LIMIT: &lt;120 km/h JUMP
            </span>
          </div>

          <div className="space-y-2 mt-2">
            {nodes.slice(0, 4).map((node) => {
              const baroDelta = Math.abs(node.alt - node.baro_alt);
              const isBaroWarning = baroDelta > 20.0;
              const hasAnomaly = node.anomaly_flags.length > 0;

              return (
                <div
                  key={node.node_id}
                  className="flex items-center justify-between bg-black/40 px-3 py-1.5 rounded border border-slate-800/80 text-[10px]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-300">{node.node_id}</span>
                    <span className="text-slate-500">[{node.callsign}]</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-slate-500">Speed: </span>
                      <span className="text-cyan-300 font-mono font-semibold">
                        {node.speed_kmh.toFixed(1)} km/h
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500">Baro Δ: </span>
                      <span
                        className={`font-mono font-semibold ${
                          isBaroWarning ? "text-rose-400" : "text-emerald-300"
                        }`}
                      >
                        {baroDelta.toFixed(1)}m
                      </span>
                    </div>

                    <div className="w-20 text-right">
                      {hasAnomaly ? (
                        <span className="text-rose-400 font-bold text-[9px] bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800">
                          ALERT
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-[9px]">
                          VALID
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
