/**
 * KineticMesh - Standalone Client-Side Consensus & Simulation Engine
 * Powers the zero-dependency Vercel web demo when local FastAPI backend is offline.
 */

import { SwarmTelemetry, SwarmNode, ConsensusBlock, AttackStatus } from "@/types/telemetry";

const INITIAL_NODES = [
  { id: "Alpha-1", callsign: "VIPER-01", role: "Flight Lead", icao: "0xA1B201", enu: [0.0, 0.0, 120.0] as [number, number, number] },
  { id: "Beta-2", callsign: "VIPER-02", role: "Port Wing", icao: "0xA1B202", enu: [-35.0, -30.0, 120.0] as [number, number, number] },
  { id: "Gamma-3", callsign: "VIPER-03", role: "Starboard Wing", icao: "0xA1B203", enu: [35.0, -30.0, 120.0] as [number, number, number] },
  { id: "Delta-4", callsign: "VIPER-04", role: "Port Outer", icao: "0xA1B204", enu: [-70.0, -60.0, 120.0] as [number, number, number] },
  { id: "Epsilon-5", callsign: "VIPER-05", role: "Starboard Outer", icao: "0xA1B205", enu: [70.0, -60.0, 120.0] as [number, number, number] },
];

class MockConsensusEngine {
  private cycle: number = 0;
  private timeSec: number = 0;
  private nodesState: Record<string, SwarmNode> = {};
  private centerEnu: [number, number, number] = [0.0, 0.0, 120.0];
  private lastBlockHash: string = "0000000000000000000000000000000000000000000000000000000000000000";
  private blocks: ConsensusBlock[] = [];

  // Attack States
  public attackStatus: AttackStatus = {
    ghost_injection: { active: false, ghost_id: "Ghost-X9", icao: "0xA94F12" },
    gps_drift: { active: false, target_node: "Gamma-3", offset_meters: 0.0, max_drift_meters: 2500.0 },
    meaconing: { active: false, target_node: "Beta-2", delay_frames: 6 },
  };

  public emergencyMode: "PATROL" | "SCATTER" | "RTH" = "PATROL";
  public telemetrySource: "MOCK" | "MAVLINK_SITL" = "MOCK";

  constructor() {
    this.reset();
  }

  public reset() {
    this.cycle = 0;
    this.timeSec = 0;
    this.attackStatus = {
      ghost_injection: { active: false, ghost_id: "Ghost-X9", icao: "0xA94F12" },
      gps_drift: { active: false, target_node: "Gamma-3", offset_meters: 0.0, max_drift_meters: 2500.0 },
      meaconing: { active: false, target_node: "Beta-2", delay_frames: 6 },
    };
    this.emergencyMode = "PATROL";
    this.nodesState = {};

    const baseLat = 37.7749;
    const baseLon = -122.4194;

    INITIAL_NODES.forEach((n) => {
      this.nodesState[n.id] = {
        node_id: n.id,
        callsign: n.callsign,
        role: n.role,
        icao_hex: n.icao,
        timestamp: Date.now() / 1000,
        seq: 1,
        pos_enu: [...n.enu],
        true_pos_enu: [...n.enu],
        estimated_pos_enu: [...n.enu],
        vel_enu: [14.0, 24.0, 0.0],
        accel_enu: [0.1, 0.2, 0.0],
        speed_kmh: 99.8,
        heading: 30.2,
        baro_alt: n.enu[2],
        lat: baseLat + n.enu[1] * 0.000009,
        lon: baseLon + n.enu[0] * 0.000011,
        alt: n.enu[2],
        reported_lat: baseLat + n.enu[1] * 0.000009,
        reported_lon: baseLon + n.enu[0] * 0.000011,
        reported_alt: n.enu[2],
        estimated_lat: baseLat + n.enu[1] * 0.000009,
        estimated_lon: baseLon + n.enu[0] * 0.000011,
        estimated_alt: n.enu[2],
        is_ghost: false,
        is_compromised: false,
        is_isolated: false,
        trust_score: 100.0,
        spatial_residual_m: 0.15,
        anomaly_flags: [],
      };
    });
  }

  public triggerAttack(type: string, active: boolean, target?: string) {
    if (type === "gps_drift") {
      this.attackStatus.gps_drift.active = active;
      if (target) this.attackStatus.gps_drift.target_node = target;
      if (!active) this.attackStatus.gps_drift.offset_meters = 0.0;
    } else if (type === "ghost_injection") {
      this.attackStatus.ghost_injection.active = active;
    } else if (type === "meaconing") {
      this.attackStatus.meaconing.active = active;
      if (target) this.attackStatus.meaconing.target_node = target;
    }
  }

  public step(dt: number = 1.0): SwarmTelemetry {
    this.cycle += 1;
    this.timeSec += dt;
    const now = Date.now() / 1000;

    // Advance center position along flight path
    this.centerEnu[0] += 14.0 * dt;
    this.centerEnu[1] += 24.0 * dt;

    const activeNodeIds = INITIAL_NODES.map((n) => n.id);
    if (this.attackStatus.ghost_injection.active) {
      activeNodeIds.push(this.attackStatus.ghost_injection.ghost_id);
    }

    // 1. Advance true physical flight positions
    INITIAL_NODES.forEach((template) => {
      const state = this.nodesState[template.id];
      if (!state) return;

      state.seq += 1;
      state.timestamp = now;

      // Formation offset relative to center
      const offsetX = template.enu[0];
      const offsetY = template.enu[1];
      const offsetZ = template.enu[2];

      const trueX = this.centerEnu[0] + offsetX;
      const trueY = this.centerEnu[1] + offsetY;
      const trueZ = this.centerEnu[2] + offsetZ;

      state.true_pos_enu = [trueX, trueY, trueZ];
      state.pos_enu = [trueX, trueY, trueZ];
      state.estimated_pos_enu = [trueX, trueY, trueZ];
      state.vel_enu = [14.0, 24.0, 0.0];
      state.speed_kmh = 99.8;
      state.heading = 30.2;
      state.anomaly_flags = [];
    });

    // 2. Apply Attacks
    const quarantined: string[] = [];

    // GPS Drift on Gamma-3
    if (this.attackStatus.gps_drift.active) {
      const tgt = this.attackStatus.gps_drift.target_node;
      this.attackStatus.gps_drift.offset_meters = Math.min(
        this.attackStatus.gps_drift.max_drift_meters,
        this.attackStatus.gps_drift.offset_meters + 65.0 * dt
      );

      const offset = this.attackStatus.gps_drift.offset_meters;
      const node = this.nodesState[tgt];
      if (node) {
        // Spoof reported GPS
        node.pos_enu = [
          node.true_pos_enu[0] + offset * 0.8,
          node.true_pos_enu[1] + offset * 0.6,
          node.true_pos_enu[2] + offset * 0.05,
        ];
        node.drift_offset_m = offset;
        node.spatial_residual_m = Math.round(offset * 0.65 * 10) / 10;

        if (node.spatial_residual_m > 15.0) {
          node.is_compromised = true;
          node.is_isolated = true;
          node.trust_score = Math.max(0.0, node.trust_score - 45.0);
          node.anomaly_flags = [
            `SPATIAL_CONSENSUS_VIOLATION: ε = ${node.spatial_residual_m}m > 15.0m threshold`,
            `AERODYNAMIC_POWER_EXCEEDED: Power draw ${(2000 + offset * 10).toFixed(0)}W > 1800W limit`,
          ];
          quarantined.push(tgt);

          // Dead reckoning fallover recovers true position with < 1.5m error
          node.estimated_pos_enu = [
            node.true_pos_enu[0] + (Math.random() - 0.5) * 1.8,
            node.true_pos_enu[1] + (Math.random() - 0.5) * 1.8,
            node.true_pos_enu[2] + (Math.random() - 0.5) * 0.6,
          ];
        }
      }
    } else {
      const node = this.nodesState["Gamma-3"];
      if (node) {
        node.is_compromised = false;
        node.is_isolated = false;
        node.trust_score = Math.min(100.0, node.trust_score + 10.0);
        node.spatial_residual_m = 0.12;
      }
    }

    // Ghost Drone Injection
    if (this.attackStatus.ghost_injection.active) {
      const gid = this.attackStatus.ghost_injection.ghost_id;
      this.nodesState[gid] = {
        node_id: gid,
        callsign: "GHOST-SP-9",
        role: "Rogue Contact",
        icao_hex: this.attackStatus.ghost_injection.icao,
        timestamp: now,
        seq: 142,
        pos_enu: [this.centerEnu[0] + 50.0, this.centerEnu[1] + 90.0, 780.0],
        true_pos_enu: [this.centerEnu[0] + 50.0, this.centerEnu[1] + 90.0, 780.0],
        estimated_pos_enu: [this.centerEnu[0] + 50.0, this.centerEnu[1] + 90.0, 780.0],
        vel_enu: [20.0, 10.0, 0.0],
        accel_enu: [0.0, 0.0, 0.0],
        speed_kmh: 80.0,
        heading: 26.5,
        baro_alt: 187.0,
        lat: 37.7758,
        lon: -122.4188,
        alt: 780.0,
        reported_lat: 37.7758,
        reported_lon: -122.4188,
        reported_alt: 780.0,
        estimated_lat: 37.7758,
        estimated_lon: -122.4188,
        estimated_alt: 780.0,
        is_ghost: true,
        is_compromised: true,
        is_isolated: true,
        trust_score: 0.0,
        spatial_residual_m: 999.0,
        anomaly_flags: [
          "BARO_DECOUPLING: |GPS(780.0m) - Baro(187.0m)| = 593.0m > 20.0m",
          "PHYSICAL_UWB_ABSENCE: Zero peer ToF ranging response received (-1.0)",
        ],
      };
      quarantined.push(gid);
    } else {
      delete this.nodesState["Ghost-X9"];
    }

    // Meaconing on Beta-2
    if (this.attackStatus.meaconing.active) {
      const node = this.nodesState[this.attackStatus.meaconing.target_node];
      if (node) {
        node.is_compromised = true;
        node.trust_score = Math.max(10.0, node.trust_score - 30.0);
        node.anomaly_flags = [
          "TIMESTAMP_REPLAY: Duplicate or non-monotonic packet timestamp detected",
          "SEQUENCE_REPLAY: Non-monotonic sequence counter detected",
        ];
        if (!quarantined.includes(node.node_id)) quarantined.push(node.node_id);
      }
    }

    // 3. Compute UWB Distance Matrix & Pairwise Residuals
    const rangingMatrix: Record<string, Record<string, number>> = {};
    const pairwiseResiduals: Record<string, Record<string, number>> = {};

    activeNodeIds.forEach((id_i) => {
      rangingMatrix[id_i] = {};
      pairwiseResiduals[id_i] = {};

      activeNodeIds.forEach((id_j) => {
        if (id_i === id_j) {
          rangingMatrix[id_i][id_j] = 0.0;
          pairwiseResiduals[id_i][id_j] = 0.0;
          return;
        }

        // If either is ghost, no physical UWB
        if (id_i === "Ghost-X9" || id_j === "Ghost-X9") {
          rangingMatrix[id_i][id_j] = -1.0;
          pairwiseResiduals[id_i][id_j] = 0.0;
          return;
        }

        const p1 = this.nodesState[id_i].true_pos_enu;
        const p2 = this.nodesState[id_j].true_pos_enu;
        const trueDist = Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + (p1[2] - p2[2]) ** 2);
        const noise = (Math.random() - 0.5) * 0.2;
        const measured = Math.round((trueDist + noise) * 1000) / 1000;

        rangingMatrix[id_i][id_j] = measured;

        const rep1 = this.nodesState[id_i].pos_enu;
        const rep2 = this.nodesState[id_j].pos_enu;
        const gpsDist = Math.sqrt((rep1[0] - rep2[0]) ** 2 + (rep1[1] - rep2[1]) ** 2 + (rep1[2] - rep2[2]) ** 2);
        pairwiseResiduals[id_i][id_j] = Math.round(Math.abs(gpsDist - measured) * 100) / 100;
      });
    });

    // 4. Build Consensus Block
    const blockIndex = this.cycle;
    const votes: Record<string, Record<string, boolean>> = {};
    activeNodeIds.forEach((voter) => {
      votes[voter] = {};
      activeNodeIds.forEach((target) => {
        votes[voter][target] = !quarantined.includes(target);
      });
    });

    const blockHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const merkleRoot = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    const block: ConsensusBlock = {
      block_index: blockIndex,
      prev_hash: this.lastBlockHash,
      block_hash: blockHash,
      timestamp: now,
      cycle: this.cycle,
      votes,
      quarantined_nodes: quarantined,
      merkle_root: merkleRoot,
    };
    this.lastBlockHash = blockHash;
    this.blocks.unshift(block);
    if (this.blocks.length > 50) this.blocks.pop();

    return {
      cycle: this.cycle,
      timestamp: now,
      swarm_center_enu: this.centerEnu,
      nodes: { ...this.nodesState },
      ranging_matrix_uwb: rangingMatrix,
      pairwise_residuals: pairwiseResiduals,
      quarantined_nodes: quarantined,
      consensus_block: block,
      attack_status: this.attackStatus,
      emergency_mode: this.emergencyMode,
      telemetry_source: this.telemetrySource,
      consensus_mode: quarantined.length > 0 ? "DEGRADED_FAILOVER" : "NOMINAL_CONSENSUS",
      global_coordinated_spoof: false,
      resilience_metrics: {
        knn_k: 3,
        knn_edges_active: 9,
        knn_pruned_links_count: 1,
        topology_efficiency: "O(3N) Sparse Mesh",
        link_availability_pct: 100.0,
        rf_blackout_active: false,
        nlos_outliers_rejected_total: 5,
        recent_nlos_filtered_events: [],
      },
      mavlink_status: {
        is_running: true,
        is_receiving: true,
        port: 14550,
        packets_received: this.cycle * 12,
        tracked_systems: ["Alpha-1", "Beta-2", "Gamma-3", "Delta-4", "Epsilon-5"],
      },
      uwb_hardware_status: {
        driver_name: "Decawave DWM3000 UWB",
        port: "COM3 / /dev/ttyUSB0",
        baudrate: 115200,
        is_physical_hardware_connected: false,
        mode: "STANDBY_EMULATION",
        packets_parsed: this.cycle * 8,
      },
    };
  }
}

export const mockSwarmEngine = new MockConsensusEngine();
