"use client";

import React, { useState, useEffect, useRef } from "react";
import { SwarmTelemetry, SwarmNode } from "@/types/telemetry";
import { Navbar } from "@/components/Navbar";
import { TacticalRadarMap } from "@/components/TacticalRadarMap";
import { AttackControls } from "@/components/AttackControls";
import { ConsensusTerminal } from "@/components/ConsensusTerminal";
import { TelemetryHUD } from "@/components/TelemetryHUD";
import { NodeDetailModal } from "@/components/NodeDetailModal";
import { SystemHardeningPanel } from "@/components/SystemHardeningPanel";
import { tacticalAudio } from "@/lib/audio";
import { tacticalVoice } from "@/lib/voice";

// Dual-stack host resolver for Windows (avoids IPv6 ::1 vs IPv4 127.0.0.1 mismatch)
const getEndpoints = () => {
  if (typeof window === "undefined") {
    return {
      api: "http://127.0.0.1:8000",
      ws: "ws://127.0.0.1:8000/ws/telemetry",
      fallbackApi: "http://localhost:8000",
      fallbackWs: "ws://localhost:8000/ws/telemetry",
    };
  }
  const host = window.location.hostname || "127.0.0.1";
  const primaryHost = (host === "localhost" || host === "127.0.0.1") ? "127.0.0.1" : host;
  const secondaryHost = primaryHost === "127.0.0.1" ? "localhost" : "127.0.0.1";

  return {
    api: `http://${primaryHost}:8000`,
    ws: `ws://${primaryHost}:8000/ws/telemetry`,
    fallbackApi: `http://${secondaryHost}:8000`,
    fallbackWs: `ws://${secondaryHost}:8000/ws/telemetry`,
  };
};

export default function KineticMeshCockpit() {
  const [telemetry, setTelemetry] = useState<SwarmTelemetry | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const prevQuarantinedRef = useRef<string[]>([]);
  const activeApiUrlRef = useRef<string>("http://127.0.0.1:8000");

  // Immediate Initial Fetch & Continuous Real-time Synchronization
  useEffect(() => {
    let isMounted = true;
    let reconnectTimer: NodeJS.Timeout;
    const endpoints = getEndpoints();
    activeApiUrlRef.current = endpoints.api;

    // 1. Instant telemetry fetch upon mount so radar renders 5 nodes in <50ms
    const fetchInstantSnapshot = async () => {
      try {
        const res = await fetch(`${endpoints.api}/api/swarm/status`, { cache: "no-store" });
        if (res.ok && isMounted) {
          const data: SwarmTelemetry = await res.json();
          setTelemetry(data);
          setIsConnected(true);
          return;
        }
      } catch {
        // Try fallback host
        try {
          const res2 = await fetch(`${endpoints.fallbackApi}/api/swarm/status`, { cache: "no-store" });
          if (res2.ok && isMounted) {
            const data2: SwarmTelemetry = await res2.json();
            setTelemetry(data2);
            activeApiUrlRef.current = endpoints.fallbackApi;
            setIsConnected(true);
          }
        } catch {}
      }
    };

    fetchInstantSnapshot();

    // 2. High-speed WebSocket live telemetry stream
    let wsAttempts = 0;
    const connectWebSocket = () => {
      if (!isMounted) return;
      const targetWs = wsAttempts % 2 === 0 ? endpoints.ws : endpoints.fallbackWs;
      wsAttempts++;

      try {
        const ws = new WebSocket(targetWs);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data: SwarmTelemetry = JSON.parse(event.data);
            setTelemetry(data);
            setIsConnected(true);

            // Audio & Synthetic Voice alerts on quarantine status changes
            const quarantined = data.quarantined_nodes || [];
            if (quarantined.length > prevQuarantinedRef.current.length) {
              tacticalAudio.playAlert();
              const newlyIsolated = quarantined.filter(x => !prevQuarantinedRef.current.includes(x));
              if (newlyIsolated.length > 0) {
                tacticalVoice.speak(`Warning: Consensus breach detected. Node ${newlyIsolated.join(", ")} isolated. Dead-reckoning fallover engaged.`);
              }
            } else if (quarantined.length === 0 && prevQuarantinedRef.current.length > 0) {
              tacticalAudio.playConsensusLock();
              tacticalVoice.speak("Swarm consensus re-established. All nodes nominal.");
            }
            prevQuarantinedRef.current = quarantined;
          } catch (err) {
            console.error("Failed to parse telemetry frame:", err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          reconnectTimer = setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimer = setTimeout(connectWebSocket, 2500);
      }
    };

    connectWebSocket();

    // 3. Fallback polling loop (keeps radar live even if WebSockets are blocked by proxies)
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch(`${activeApiUrlRef.current}/api/swarm/status`, { cache: "no-store" });
          if (res.ok) {
            const data: SwarmTelemetry = await res.json();
            setTelemetry(data);
            setIsConnected(true);
          }
        } catch {}
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle Adversarial Attack Injection
  const handleTriggerAttack = async (
    attackType: string,
    active: boolean,
    targetNode: string = "Gamma-3"
  ) => {
    setIsLoading(true);
    const endpoints = getEndpoints();
    try {
      const res = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/attack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attack_type: attackType,
          active,
          target_node: targetNode,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to trigger attack");
      }
      const statusRes = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/status`, { cache: "no-store" });
      if (statusRes.ok) {
        const data = await statusRes.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.error("Attack trigger error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Emergency Guidance Mode (Extension 4)
  const handleTriggerEmergency = async (mode: "PATROL" | "SCATTER" | "RTH") => {
    setIsLoading(true);
    const endpoints = getEndpoints();
    try {
      const res = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/emergency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        throw new Error("Failed to set emergency guidance mode");
      }
      const statusRes = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/status`, { cache: "no-store" });
      if (statusRes.ok) {
        const data = await statusRes.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.error("Emergency mode error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Telemetry Source Toggle (Extension 1: MOCK vs MAVLINK_SITL)
  const handleToggleSource = async (source: "MOCK" | "MAVLINK_SITL") => {
    setIsLoading(true);
    const endpoints = getEndpoints();
    try {
      const res = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (res.ok) {
        tacticalVoice.speak(`Swarm telemetry source switched to ${source === "MOCK" ? "simulated mesh" : "live MAVLink SITL"}.`);
        const statusRes = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/status`, { cache: "no-store" });
        if (statusRes.ok) {
          const data = await statusRes.json();
          setTelemetry(data);
        }
      }
    } catch (err) {
      console.error("Source toggle error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Swarm Reset
  const handleResetSwarm = async () => {
    setIsLoading(true);
    const endpoints = getEndpoints();
    try {
      const res = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/reset`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to reset swarm");
      }
      const statusRes = await fetch(`${activeApiUrlRef.current || endpoints.api}/api/swarm/status`, { cache: "no-store" });
      if (statusRes.ok) {
        const data = await statusRes.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedNode = selectedNodeId && telemetry ? telemetry.nodes[selectedNodeId] : null;
  const peerRangesForSelected = selectedNodeId && telemetry
    ? telemetry.ranging_matrix_uwb?.[selectedNodeId]
    : undefined;

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-200 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Tactical Navbar */}
      <Navbar
        isConnected={isConnected}
        epoch={telemetry?.cycle || 0}
        quarantinedCount={telemetry?.quarantined_nodes?.length || 0}
        telemetrySource={telemetry?.telemetry_source}
        emergencyMode={telemetry?.emergency_mode}
        mavlinkPacketCount={telemetry?.mavlink_status?.packets_received}
        onToggleSource={handleToggleSource}
      />

      {/* Main Tactical Operations Dashboard */}
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1720px] w-full mx-auto">
        {/* Core Top Split: Radar Airspace Map vs Telemetry & Consensus */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Left Column: Airspace Radar & Attack Console (7 cols) */}
          <div className="xl:col-span-7 space-y-4">
            <TacticalRadarMap
              telemetry={telemetry}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />

            <AttackControls
              attackStatus={telemetry?.attack_status}
              emergencyMode={telemetry?.emergency_mode}
              onTriggerAttack={handleTriggerAttack}
              onTriggerEmergency={handleTriggerEmergency}
              onResetSwarm={handleResetSwarm}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column: Consensus Ledger & Telemetry HUD (5 cols) */}
          <div className="xl:col-span-5 space-y-4">
            <ConsensusTerminal telemetry={telemetry} />

            <TelemetryHUD
              telemetry={telemetry}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        </div>

        {/* Operational Hardening & Edge-Case Resilience Panel */}
        <div className="mt-4">
          <SystemHardeningPanel telemetry={telemetry} />
        </div>
      </main>

      {/* Detailed Avionics Node Modal */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          peerRanges={peerRangesForSelected}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
