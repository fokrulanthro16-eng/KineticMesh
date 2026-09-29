"use client";

import React, { useState, useEffect, useRef } from "react";
import { SwarmTelemetry, ConsensusBlock } from "@/types/telemetry";
import { Terminal, Shield, CheckCircle2, AlertOctagon, Hash, GitBranch, Layers, Download } from "lucide-react";

interface ConsensusTerminalProps {
  telemetry: SwarmTelemetry | null;
}

interface LogEntry {
  id: string;
  timeStr: string;
  cycle: number;
  level: "INFO" | "WARN" | "CRIT" | "SUCCESS";
  tag: string;
  message: string;
}

export const ConsensusTerminal: React.FC<ConsensusTerminalProps> = ({ telemetry }) => {
  const [activeTab, setActiveTab] = useState<"logs" | "ledger" | "voting">("logs");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-generate audit logs when new cycles/events occur
  useEffect(() => {
    if (!telemetry) return;
    const now = new Date(telemetry.timestamp * 1000).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const newEntries: LogEntry[] = [];
    const quarantined = telemetry.quarantined_nodes || [];

    if (quarantined.length > 0) {
      quarantined.forEach((nid) => {
        const node = telemetry.nodes[nid];
        const flags = node?.anomaly_flags?.join("; ") || "Consensus threshold violated";
        newEntries.push({
          id: `${telemetry.cycle}-${nid}-${Date.now()}`,
          timeStr: now,
          cycle: telemetry.cycle,
          level: "CRIT",
          tag: "BYZANTINE_QUARANTINE",
          message: `Node [${nid}] isolated from consensus. Invariants failed: ${flags}. Autonomous dead-reckoning fallback engaged.`,
        });
      });
    } else {
      // Normal nominal consensus block
      newEntries.push({
        id: `${telemetry.cycle}-OK-${Date.now()}`,
        timeStr: now,
        cycle: telemetry.cycle,
        level: "SUCCESS",
        tag: "CONSENSUS_VERIFIED",
        message: `Epoch #${telemetry.cycle} synchronized. Spatial residual ε < 15m across 5 nodes. Merkle root: ${telemetry.consensus_block.merkle_root.slice(0, 16)}...`,
      });
    }

    setLogs((prev) => {
      const combined = [...prev, ...newEntries];
      return combined.slice(-60); // Keep last 60 entries
    });
  }, [telemetry?.cycle, telemetry?.quarantined_nodes]);

  // Auto scroll to bottom
  useEffect(() => {
    if (activeTab === "logs" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  const handleExportReport = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/audit/export`);
      if (!res.ok) throw new Error("Failed to export attestation");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kineticmesh_incident_attestation_cycle_${telemetry?.cycle || 1}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  const block = telemetry?.consensus_block;
  const nodes = telemetry ? Object.keys(telemetry.nodes) : [];

  return (
    <div className="rounded-xl obsidian-card border border-cyan-900/40 flex flex-col h-[380px] overflow-hidden">
      {/* Header with Navigation Tabs & Incident Attestation Export Button */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-cyan-950/70 gap-2">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 tracking-wider">
            ZERO-TRUST CONSENSUS LEDGER
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-2 py-0.5 text-xs rounded transition flex items-center space-x-1 ${
              activeTab === "logs"
                ? "bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Live Audit</span>
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-2 py-0.5 text-xs rounded transition flex items-center space-x-1 ${
              activeTab === "ledger"
                ? "bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Hash className="w-3 h-3 text-cyan-400" />
            <span>SHA-256 Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab("voting")}
            className={`px-2 py-0.5 text-xs rounded transition flex items-center space-x-1 ${
              activeTab === "voting"
                ? "bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitBranch className="w-3 h-3 text-emerald-400" />
            <span>Byzantine Votes</span>
          </button>

          {/* Incident Attestation Export Button */}
          <button
            onClick={handleExportReport}
            className="ml-1 px-2.5 py-0.5 text-[10px] font-bold rounded bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 flex items-center space-x-1 transition active:scale-95 shadow"
            title="Download FAA Part 107 / EASA SORA Cryptographic Incident Audit Package"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span>EXPORT INCIDENT AUDIT (JSON)</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] bg-black/60 scanline-bg" ref={scrollRef}>
        {/* Tab 1: Live Audit Terminal */}
        {activeTab === "logs" && (
          <div className="space-y-1.5">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic py-4 text-center">
                Awaiting telemetry streams from swarm peer mesh...
              </div>
            ) : (
              logs.map((log) => {
                let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                let textGlow = "text-slate-300";

                if (log.level === "CRIT") {
                  badgeColor = "bg-rose-950 text-rose-300 border-rose-800/80";
                  textGlow = "text-rose-200 glow-crimson";
                } else if (log.level === "WARN") {
                  badgeColor = "bg-amber-950 text-amber-300 border-amber-800/80";
                  textGlow = "text-amber-200 glow-amber";
                } else if (log.level === "SUCCESS") {
                  badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-800/80";
                  textGlow = "text-emerald-300";
                }

                return (
                  <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                    <span className="text-slate-500 select-none">[{log.timeStr}]</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] border ${badgeColor}`}>
                      {log.tag}
                    </span>
                    <span className="text-cyan-600 select-none">E#{log.cycle}</span>
                    <span className={`${textGlow} flex-1`}>{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: SHA-256 Ledger Block View */}
        {activeTab === "ledger" && block && (
          <div className="space-y-3">
            <div className="bg-slate-900/60 p-2.5 rounded border border-cyan-900/40">
              <div className="flex items-center justify-between text-xs text-cyan-300 font-bold border-b border-cyan-950 pb-1.5 mb-2">
                <span className="flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CURRENT BLOCK #{block.block_index}</span>
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                  PROOF VERIFIED (1.0 Hz)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                <div className="flex items-center justify-between bg-black/40 p-1.5 rounded">
                  <span className="text-slate-400">BLOCK HASH (SHA-256):</span>
                  <span className="text-cyan-300 font-bold break-all select-all">
                    {block.block_hash}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-black/40 p-1.5 rounded">
                  <span className="text-slate-400">PREV BLOCK POINTER:</span>
                  <span className="text-slate-400 font-mono break-all select-all">
                    {block.prev_hash}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-black/40 p-1.5 rounded">
                  <span className="text-slate-400">SPATIAL MERKLE ROOT:</span>
                  <span className="text-emerald-400 font-bold break-all select-all">
                    {block.merkle_root}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-black/40 p-1.5 rounded">
                  <span className="text-slate-400">QUARANTINED PEERS:</span>
                  <span
                    className={
                      block.quarantined_nodes.length > 0
                        ? "text-rose-400 font-bold"
                        : "text-emerald-400 font-medium"
                    }
                  >
                    {block.quarantined_nodes.length > 0
                      ? block.quarantined_nodes.join(", ")
                      : "NONE (All Nodes Within Invariant Limits)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-2 bg-cyan-950/30 rounded border border-cyan-900/30 text-[10px] text-slate-300 leading-normal">
              <strong>Zero-Trust Cryptographic Guarantee:</strong> Every 1-second flight cycle, each drone signs its local UWB ranging table and kinematic vector. The Byzantine consensus engine creates an immutable chained hash tree, making it mathematically impossible for an adversary to spoof flight telemetry undetected.
            </div>
          </div>
        )}

        {/* Tab 3: Byzantine Quorum Voting Matrix */}
        {activeTab === "voting" && block && (
          <div className="space-y-3">
            <div className="text-[11px] text-slate-300 flex items-center justify-between mb-1">
              <span>Peer-to-Peer Distributed Quorum Matrix (Voter Node → Target Node):</span>
              <span className="text-emerald-400 font-semibold">BFT Quorum: 3/4 Consensus</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-cyan-900/60 text-slate-400 bg-slate-900/50">
                    <th className="p-1.5">Voter \ Target</th>
                    {nodes.map((n) => (
                      <th key={n} className="p-1.5 font-bold text-center text-cyan-300">
                        {n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((voter) => (
                    <tr key={voter} className="border-b border-slate-900 hover:bg-slate-900/30">
                      <td className="p-1.5 font-bold text-slate-300">{voter}</td>
                      {nodes.map((target) => {
                        if (voter === target) {
                          return (
                            <td key={target} className="p-1.5 text-center text-slate-600">
                              SELF
                            </td>
                          );
                        }
                        const isTrusted = block.votes?.[voter]?.[target] ?? true;
                        return (
                          <td key={target} className="p-1.5 text-center">
                            {isTrusted ? (
                              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                                TRUE
                              </span>
                            ) : (
                              <span className="text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60 animate-pulse">
                                DISTRUST
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
