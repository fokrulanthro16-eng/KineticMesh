"use client";

import React, { useRef, useEffect, useState } from "react";
import { SwarmTelemetry, SwarmNode } from "@/types/telemetry";
import { ZoomIn, ZoomOut, Crosshair, Eye, ShieldAlert, Radio } from "lucide-react";

interface TacticalRadarProps {
  telemetry: SwarmTelemetry | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export const TacticalRadarMap: React.FC<TacticalRadarProps> = ({
  telemetry,
  selectedNodeId,
  onSelectNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.2);
  const [showRangingLabels, setShowRangingLabels] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"2d" | "iso">("2d");
  const [sweepAngle, setSweepAngle] = useState<number>(0);

  // Sweep rotation animation loop
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setSweepAngle((prev) => (prev + 0.035) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Main Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate scale factor: 1 meter = scale px
    const basePixelsPerMeter = 1.6 * zoom;

    // Center reference relative to Swarm Lead (Alpha-1)
    const leadNode = telemetry?.nodes["Alpha-1"];
    const refX = leadNode ? leadNode.pos_enu[0] : 0;
    const refY = leadNode ? leadNode.pos_enu[1] : 0;

    // Project [East, North] in meters to Canvas [x, y]
    const project = (east: number, north: number): [number, number] => {
      const dx = east - refX;
      const dy = north - refY;

      if (viewMode === "2d") {
        // North is UP (negative Y in canvas), East is RIGHT (positive X)
        return [
          centerX + dx * basePixelsPerMeter,
          centerY - dy * basePixelsPerMeter,
        ];
      } else {
        // Isometric 2.5D perspective
        const isoX = (dx - dy) * Math.cos(Math.PI / 6);
        const isoY = (dx + dy) * Math.sin(Math.PI / 6);
        return [
          centerX + isoX * basePixelsPerMeter,
          centerY - isoY * basePixelsPerMeter * 0.7,
        ];
      }
    };

    // Draw Tactical Radar Grid and Concentric Range Rings
    ctx.save();
    const ringDistances = [25, 50, 100, 200, 500, 1000, 2000];
    ringDistances.forEach((dist) => {
      const r = dist * basePixelsPerMeter;
      if (r > Math.max(width, height) * 1.5) return;

      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(14, 165, 233, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ring Range Label
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(14, 165, 233, 0.4)";
      ctx.fillText(`${dist}m`, centerX + r + 3, centerY - 3);
    });

    // Crosshairs
    ctx.strokeStyle = "rgba(14, 165, 233, 0.2)";
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Radar Sweep Cone
    const sweepRadius = Math.max(width, height) * 0.9;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sweepRadius);
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.18)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0)");

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, sweepRadius, sweepAngle - 0.35, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Sweep lead line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(sweepAngle) * sweepRadius,
      centerY + Math.sin(sweepAngle) * sweepRadius
    );
    ctx.strokeStyle = "rgba(52, 211, 153, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    if (!telemetry) {
      ctx.restore();
      return;
    }

    const nodes = Object.values(telemetry.nodes);
    const rangingMatrix = telemetry.ranging_matrix_uwb || {};
    const pairwiseResiduals = telemetry.pairwise_residuals || {};

    // 1. Draw Mesh Peer Links
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        // Position coordinates
        const posA = nodeA.is_compromised ? nodeA.estimated_pos_enu : nodeA.pos_enu;
        const posB = nodeB.is_compromised ? nodeB.estimated_pos_enu : nodeB.pos_enu;

        const [pAx, pAy] = project(posA[0], posA[1]);
        const [pBx, pBy] = project(posB[0], posB[1]);

        const residual = pairwiseResiduals[nodeA.node_id]?.[nodeB.node_id] || 0;
        const isEitherCompromised = nodeA.is_compromised || nodeB.is_compromised;
        const isGhostInvolved = nodeA.is_ghost || nodeB.is_ghost;

        ctx.beginPath();
        ctx.moveTo(pAx, pAy);
        ctx.lineTo(pBx, pBy);

        if (isGhostInvolved) {
          // Rogue ghost link: Failed UWB handshake
          ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 5]);
        } else if (isEitherCompromised) {
          // Dead-Reckoning Consensus fallback link (Dashed Amber)
          ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
        } else if (residual > 15) {
          // Discordant peer link (Red)
          ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
          ctx.lineWidth = 2.0;
          ctx.setLineDash([]);
        } else {
          // Healthy trusted consensus link (Solid Emerald Green)
          ctx.strokeStyle = "rgba(16, 185, 129, 0.65)";
          ctx.lineWidth = 1.4;
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Ranging distance label on mesh edge
        if (showRangingLabels && !isGhostInvolved) {
          const midX = (pAx + pBx) / 2;
          const midY = (pAy + pBy) / 2;
          const uwbDist = rangingMatrix[nodeA.node_id]?.[nodeB.node_id];

          if (uwbDist && uwbDist > 0) {
            ctx.fillStyle = isEitherCompromised ? "rgba(245, 158, 11, 0.8)" : "rgba(148, 163, 184, 0.6)";
            ctx.font = "8px monospace";
            ctx.fillText(`${uwbDist.toFixed(1)}m`, midX - 12, midY - 3);
          }
        }
      }
    }

    // 2. Draw Drone Nodes & Fallback Indicators
    nodes.forEach((node) => {
      const isSelected = selectedNodeId === node.node_id;

      // If node is compromised (e.g. Gamma-3 GPS Drift), render BOTH spoofed GPS and Recovered Position
      if (node.is_compromised && !node.is_ghost) {
        // (A) Spoofed False GPS Location
        const [repX, repY] = project(node.pos_enu[0], node.pos_enu[1]);
        // (B) Recovered Consensus Dead-Reckoning Location
        const [estX, estY] = project(node.estimated_pos_enu[0], node.estimated_pos_enu[1]);

        // Draw deviation vector between reported and recovered
        ctx.beginPath();
        ctx.moveTo(estX, estY);
        ctx.lineTo(repX, repY);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on deviation line
        const midX = (estX + repX) / 2;
        const midY = (estY + repY) / 2;
        const offsetMeters = node.drift_offset_m || node.spatial_residual_m || 0;
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 9px monospace";
        ctx.fillText(`Δ GPS SKEW: +${offsetMeters.toFixed(0)}m`, midX + 6, midY - 4);

        // Render False Spoofed GPS Marker (Red Glitching Phantom)
        ctx.beginPath();
        ctx.arc(repX, repY, 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = "8px monospace";
        ctx.fillStyle = "#f87171";
        ctx.fillText(`[SPOOFED GPS] ${node.node_id}`, repX + 10, repY - 8);

        // Render Recovered Dead-Reckoning Marker (Amber Diamond)
        ctx.save();
        ctx.translate(estX, estY);
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(9, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(-9, 0);
        ctx.closePath();
        ctx.fillStyle = "rgba(245, 158, 11, 0.4)";
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`[DEAD-RECKONING] ${node.node_id}`, 12, 4);
        ctx.restore();
        return;
      }

      // Ghost Drone Marker (Red Crossed Target)
      if (node.is_ghost) {
        const [gx, gy] = project(node.pos_enu[0], node.pos_enu[1]);
        ctx.save();
        ctx.translate(gx, gy);

        // Outer pulsing ring
        ctx.beginPath();
        ctx.arc(0, 0, 11 + Math.sin(sweepAngle * 3) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#ef4444";
        ctx.fillText(`[PHANTOM SPOOF] ${node.node_id}`, 12, -4);
        ctx.fillStyle = "rgba(252, 165, 165, 0.8)";
        ctx.font = "8px monospace";
        ctx.fillText(`ICAO: ${node.icao_hex} | ZERO UWB`, 12, 8);
        ctx.restore();
        return;
      }

      // Normal Trusted Drone (Green Apex/Wing Nodes)
      const [nx, ny] = project(node.pos_enu[0], node.pos_enu[1]);

      ctx.save();
      ctx.translate(nx, ny);

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Heading direction pointer
      const headingRad = (node.heading * Math.PI) / 180;
      ctx.rotate(headingRad);

      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 4);
      ctx.lineTo(-6, 7);
      ctx.closePath();

      ctx.fillStyle = "rgba(16, 185, 129, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.rotate(-headingRad);

      // Node callsign and altitude
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#34d399";
      ctx.fillText(`${node.callsign} (${node.node_id})`, 10, -5);

      ctx.font = "8px monospace";
      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.fillText(`Alt: ${node.alt.toFixed(1)}m | ${node.speed_kmh.toFixed(0)} km/h`, 10, 6);

      ctx.restore();
    });

    ctx.restore();
  }, [telemetry, zoom, showRangingLabels, viewMode, sweepAngle, selectedNodeId]);

  // Click on canvas to select node
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetry) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const basePixelsPerMeter = 1.6 * zoom;

    const leadNode = telemetry.nodes["Alpha-1"];
    const refX = leadNode ? leadNode.pos_enu[0] : 0;
    const refY = leadNode ? leadNode.pos_enu[1] : 0;

    let clickedNode: string | null = null;
    let minDistance = 22; // Click radius

    Object.values(telemetry.nodes).forEach((node) => {
      const pos = node.is_compromised ? node.estimated_pos_enu : node.pos_enu;
      const dx = pos[0] - refX;
      const dy = pos[1] - refY;
      const px = centerX + dx * basePixelsPerMeter;
      const py = centerY - dy * basePixelsPerMeter;

      const dist = Math.sqrt((mouseX - px) ** 2 + (mouseY - py) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        clickedNode = node.node_id;
      }
    });

    onSelectNode(clickedNode);
  };

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden obsidian-card border border-cyan-900/40">
      {/* Top HUD Controls Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto">
          <div className="flex items-center space-x-2 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded border border-cyan-800/40 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-cyan-300 font-semibold tracking-wider">AIRSPACE RADAR</span>
            <span className="text-slate-400 text-[10px]">
              {telemetry ? `${Object.keys(telemetry.nodes).length} ACTIVE CONTACTS` : "SCANNING..."}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-cyan-800/40 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300">Trusted</span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-1.5"></span>
            <span className="text-slate-300">Fallover</span>
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-1.5"></span>
            <span className="text-slate-300">Spoofed</span>
          </div>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center space-x-1 pointer-events-auto bg-black/60 backdrop-blur-md rounded border border-cyan-800/40 p-1">
          <button
            onClick={() => setZoom((prev) => Math.min(prev + 0.3, 3.5))}
            className="p-1 hover:bg-cyan-950/60 rounded text-cyan-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((prev) => Math.max(prev - 0.3, 0.4))}
            className="p-1 hover:bg-cyan-950/60 rounded text-cyan-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1.2)}
            className="p-1 hover:bg-cyan-950/60 rounded text-cyan-300 transition"
            title="Reset Centering"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowRangingLabels((prev) => !prev)}
            className={`p-1 rounded transition text-xs px-1.5 ${
              showRangingLabels ? "bg-cyan-900/60 text-cyan-200" : "text-slate-400"
            }`}
            title="Toggle Ranging Labels"
          >
            UWB
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair scanline-bg"
      />

      {/* Bottom Status Overlay */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-slate-400 z-10 pointer-events-none">
        <div className="flex items-center space-x-3 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-800">
          <span>ORIGIN: EDWARDS AFB (34.9055° N, -117.8837° W)</span>
          <span>FORMATION: 5-NODE INCLINED V</span>
        </div>
        <div className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-800 text-cyan-400">
          CLICK NODE FOR AVIONICS TELEMETRY
        </div>
      </div>
    </div>
  );
};
