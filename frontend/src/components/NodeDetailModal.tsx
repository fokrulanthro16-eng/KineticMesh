"use client";

import React from "react";
import { SwarmNode } from "@/types/telemetry";
import { X, ShieldAlert, Cpu, Radio, Navigation, CheckCircle2, AlertTriangle } from "lucide-react";

interface NodeDetailModalProps {
  node: SwarmNode | null;
  peerRanges: Record<string, number> | undefined;
  onClose: () => void;
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  peerRanges,
  onClose,
}) => {
  if (!node) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl obsidian-card border border-cyan-800/80 shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-950 pb-3">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>{node.callsign}</span>
                <span className="text-slate-400 font-mono">({node.node_id})</span>
              </h2>
              <p className="text-[10px] text-slate-400">
                {node.role} • ICAO: <code className="text-cyan-300">{node.icao_hex}</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Banner */}
        <div
          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
            node.is_compromised || node.is_ghost
              ? "bg-rose-950/60 border-rose-800/80 text-rose-200"
              : "bg-emerald-950/60 border-emerald-800/80 text-emerald-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {node.is_compromised || node.is_ghost ? (
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="font-bold">
              {node.is_ghost
                ? "ROGUE TELEMETRY INJECTION (NO UWB)"
                : node.is_compromised
                ? "COMPROMISED / GPS SPOOFED (FALLOVER ACTIVE)"
                : "HEALTHY CONSENSUS PARTICIPANT"}
            </span>
          </div>
          <span className="font-mono font-bold text-sm">{node.trust_score.toFixed(0)}% TRUST</span>
        </div>

        {/* Position Vectors Comparison */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-black/50 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-1">
              Reported GPS Coordinates
            </span>
            <div>Lat: {node.reported_lat?.toFixed(5) || node.lat.toFixed(5)}°</div>
            <div>Lon: {node.reported_lon?.toFixed(5) || node.lon.toFixed(5)}°</div>
            <div>Alt: {node.reported_alt?.toFixed(1) || node.alt.toFixed(1)}m</div>
            <div className="text-[10px] text-slate-500 mt-1">
              ENU: [{node.pos_enu[0].toFixed(0)}, {node.pos_enu[1].toFixed(0)}, {node.pos_enu[2].toFixed(0)}]
            </div>
          </div>

          <div className="bg-black/50 p-2.5 rounded border border-cyan-900/40">
            <span className="text-cyan-400 block text-[9px] uppercase tracking-wider mb-1">
              Consensus Estimated Position
            </span>
            <div>Lat: {node.estimated_lat?.toFixed(5) || node.lat.toFixed(5)}°</div>
            <div>Lon: {node.estimated_lon?.toFixed(5) || node.lon.toFixed(5)}°</div>
            <div>Alt: {node.estimated_alt?.toFixed(1) || node.alt.toFixed(1)}m</div>
            <div className="text-[10px] text-cyan-500 mt-1">
              ENU: [{node.estimated_pos_enu[0].toFixed(0)}, {node.estimated_pos_enu[1].toFixed(0)}, {node.estimated_pos_enu[2].toFixed(0)}]
            </div>
          </div>
        </div>

        {/* Inter-Node Ranging Table */}
        <div className="bg-black/40 p-3 rounded-lg border border-slate-800 text-[11px]">
          <div className="flex items-center space-x-1.5 text-slate-300 font-bold mb-2 text-xs">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Physical UWB Time-of-Flight Ranging Links</span>
          </div>
          {peerRanges && Object.keys(peerRanges).length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              {Object.entries(peerRanges).map(([peerId, range]) => {
                if (peerId === node.node_id) return null;
                return (
                  <div
                    key={peerId}
                    className="flex justify-between p-1 bg-slate-900/60 rounded border border-slate-800"
                  >
                    <span className="text-slate-400">{peerId}:</span>
                    <span className={range > 0 ? "text-emerald-400 font-bold" : "text-rose-400"}>
                      {range > 0 ? `${range.toFixed(2)}m` : "DROP / NO-LINK"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-500 text-xs italic">No active peer ranging records</div>
          )}
        </div>

        {/* Anomaly Readout */}
        {node.anomaly_flags && node.anomaly_flags.length > 0 && (
          <div className="bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/60 text-[10px]">
            <span className="font-bold text-rose-300 block mb-1">
              Consensus Invariant Violations:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-rose-300 font-mono">
              {node.anomaly_flags.map((flag, idx) => (
                <li key={idx}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-200 text-xs rounded transition"
          >
            Close Avionics Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
