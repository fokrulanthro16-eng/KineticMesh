"""
KineticMesh - Swarm Orchestration & 5-Node V-Formation Simulation Core
Simulates Alpha-1, Beta-2, Gamma-3, Delta-4, Epsilon-5 flying in dynamic coordinated formation.
"""

import math
import time
from typing import Dict, List, Any, Optional
from core.kinematics import (
    geodetic_to_enu, enu_to_geodetic,
    DEFAULT_ORIGIN_LAT, DEFAULT_ORIGIN_LON, DEFAULT_ORIGIN_ALT
)
from core.ranging import RangingEngine
from core.consensus import ConsensusEngine
from core.attacks import AttackManager
from mavlink_bridge import MAVLinkBridge
from uwb_driver import DecawaveUWBDriver


class SwarmNodeConfig:
    def __init__(self, node_id: str, callsign: str, role: str,
                 offset_body: List[float], icao_hex: str):
        self.node_id = node_id
        self.callsign = callsign
        self.role = role
        self.offset_body = offset_body # [X_lateral, Y_longitudinal, Z_vertical] relative to Alpha-1
        self.icao_hex = icao_hex


DEFAULT_SWARM_CONFIG: List[SwarmNodeConfig] = [
    SwarmNodeConfig("Alpha-1", "VIPER-LEAD", "Apex Flight Lead", [0.0, 0.0, 0.0], "0x7C10A1"),
    SwarmNodeConfig("Beta-2", "VIPER-02", "Port Wing (Left Inner)", [-35.0, -30.0, 2.0], "0x7C10B2"),
    SwarmNodeConfig("Gamma-3", "VIPER-03", "Starboard Wing (Right Inner)", [35.0, -30.0, 2.0], "0x7C10C3"),
    SwarmNodeConfig("Delta-4", "VIPER-04", "Port Swept (Left Outer)", [-70.0, -60.0, 4.0], "0x7C10D4"),
    SwarmNodeConfig("Epsilon-5", "VIPER-05", "Starboard Swept (Right Outer)", [70.0, -60.0, 4.0], "0x7C10E5"),
]


class SwarmSimulator:
    """Simulates 5-node autonomous drone swarm with peer-to-peer ranging and zero-trust consensus."""

    def __init__(self):
        self.nodes = {cfg.node_id: cfg for cfg in DEFAULT_SWARM_CONFIG}
        self.ranging_engine = RangingEngine()
        self.consensus_engine = ConsensusEngine()
        self.attack_manager = AttackManager()
        self.mavlink_bridge = MAVLinkBridge()
        self.uwb_driver = DecawaveUWBDriver()
        
        # Telemetry Source Mode: "MOCK" vs "MAVLINK_SITL"
        self.telemetry_source: str = "MOCK"
        
        # Emergency Guidance Mode: "PATROL" | "SCATTER" | "RTH"
        self.emergency_mode: str = "PATROL"
        self.scatter_timer: float = 0.0
        self.rth_base_enu: List[float] = [0.0, 0.0, 100.0] # Edwards AFB Base Alpha
        
        # Flight Simulation Parameters
        self.time_elapsed: float = 0.0
        self.sim_start_time: float = time.time()
        self.cruise_speed_mps: float = 24.0 # ~86 km/h
        self.base_altitude_m: float = 120.0
        self.flight_heading_rad: float = 0.0 # Moving primarily North
        self.seq_counter: int = 1
        
        # Swarm Origin center point in ENU
        self.center_enu: List[float] = [0.0, 0.0, self.base_altitude_m]

    def set_emergency_mode(self, mode: str):
        """Set swarm guidance mode: PATROL, SCATTER, or RTH."""
        if mode in ["PATROL", "SCATTER", "RTH"]:
            self.emergency_mode = mode
            if mode == "SCATTER":
                self.scatter_timer = 0.0

    def set_telemetry_source(self, source: str):
        """Toggle telemetry source: MOCK or MAVLINK_SITL."""
        if source == "MAVLINK_SITL":
            self.telemetry_source = "MAVLINK_SITL"
            self.mavlink_bridge.start()
        else:
            self.telemetry_source = "MOCK"
            self.mavlink_bridge.stop()

    def reset_swarm(self):
        """Reset simulation state, restore patrol guidance, and clear all attacks."""
        self.time_elapsed = 0.0
        self.sim_start_time = time.time()
        self.seq_counter = 1
        self.center_enu = [0.0, 0.0, self.base_altitude_m]
        self.emergency_mode = "PATROL"
        self.scatter_timer = 0.0
        self.consensus_engine = ConsensusEngine()
        self.attack_manager.reset_all_attacks()

    def update_physics_step(self, dt: float = 1.0) -> Dict[str, Any]:
        """
        Advance swarm kinematic state by dt seconds:
        1. Propagate true physics and dynamic V-formation flight path.
        2. Apply active adversarial attacks (GPS Drift, Ghost, Meaconing).
        3. Simulate UWB peer ranging on true ground-truth coordinates.
        4. Execute Byzantine Kinematic Spatial Consensus & Fallover.
        """
        self.time_elapsed += dt
        self.seq_counter += 1
        now = self.sim_start_time + self.time_elapsed
        
        # Handle Emergency Guidance Guidance Vectors
        if self.emergency_mode == "SCATTER":
            self.scatter_timer += dt
            center_x = 350.0 * math.sin(0.04 * self.time_elapsed)
            center_y = self.cruise_speed_mps * self.time_elapsed
            center_z = self.base_altitude_m + 12.0 * math.sin(0.025 * self.time_elapsed)
            self.center_enu = [center_x, center_y, center_z]
            vx_center = 350.0 * 0.04 * math.cos(0.04 * self.time_elapsed)
            vy_center = self.cruise_speed_mps
            vz_center = 12.0 * 0.025 * math.cos(0.025 * self.time_elapsed)
            heading_rad = math.atan2(vx_center, vy_center)
            heading_deg = (math.degrees(heading_rad) + 360.0) % 360.0
        elif self.emergency_mode == "RTH":
            # Direct inertial dead-reckoning guidance vector toward Base Alpha [0, 0, 100]
            dx = self.rth_base_enu[0] - self.center_enu[0]
            dy = self.rth_base_enu[1] - self.center_enu[1]
            dist = max(1.0, math.sqrt(dx**2 + dy**2))
            vx_center = (dx / dist) * self.cruise_speed_mps
            vy_center = (dy / dist) * self.cruise_speed_mps
            vz_center = -0.5 # Controlled descent
            heading_rad = math.atan2(vx_center, vy_center)
            heading_deg = (math.degrees(heading_rad) + 360.0) % 360.0
            center_x = self.center_enu[0] + vx_center * dt
            center_y = self.center_enu[1] + vy_center * dt
            center_z = max(40.0, self.center_enu[2] + vz_center * dt)
            self.center_enu = [center_x, center_y, center_z]
        else:
            # Normal dynamic patrol corridor
            center_x = 350.0 * math.sin(0.04 * self.time_elapsed)
            center_y = self.cruise_speed_mps * self.time_elapsed
            center_z = self.base_altitude_m + 12.0 * math.sin(0.025 * self.time_elapsed)
            self.center_enu = [center_x, center_y, center_z]
            vx_center = 350.0 * 0.04 * math.cos(0.04 * self.time_elapsed)
            vy_center = self.cruise_speed_mps
            vz_center = 12.0 * 0.025 * math.cos(0.025 * self.time_elapsed)
            heading_rad = math.atan2(vx_center, vy_center)
            heading_deg = (math.degrees(heading_rad) + 360.0) % 360.0
        
        cos_hdg = math.cos(heading_rad)
        sin_hdg = math.sin(heading_rad)
        
        # 1. Generate True Ground-Truth Kinematics for each drone node
        true_states: Dict[str, Dict[str, Any]] = {}
        for nid, cfg in self.nodes.items():
            bx, by, bz = cfg.offset_body
            # Rotate body offset into ENU frame
            rot_e = bx * cos_hdg + by * sin_hdg
            rot_n = -bx * sin_hdg + by * cos_hdg
            rot_u = bz
            
            true_pos = [
                center_x + rot_e,
                center_y + rot_n,
                center_z + rot_u
            ]
            
            # Apply radial scatter dispersal offsets to avoid mid-air collision in emergency
            if self.emergency_mode == "SCATTER":
                scatter_vectors = {
                    "Alpha-1": [0.0, 18.0 * self.scatter_timer, 6.0 * self.scatter_timer],
                    "Beta-2": [-25.0 * self.scatter_timer, -10.0 * self.scatter_timer, 2.0 * self.scatter_timer],
                    "Gamma-3": [25.0 * self.scatter_timer, -10.0 * self.scatter_timer, 2.0 * self.scatter_timer],
                    "Delta-4": [-45.0 * self.scatter_timer, -25.0 * self.scatter_timer, 0.0],
                    "Epsilon-5": [45.0 * self.scatter_timer, -25.0 * self.scatter_timer, 0.0],
                }
                if nid in scatter_vectors:
                    s = scatter_vectors[nid]
                    true_pos[0] += s[0]
                    true_pos[1] += s[1]
                    true_pos[2] += s[2]
            
            true_vel = [vx_center, vy_center, vz_center]
            speed_kmh = math.sqrt(vx_center**2 + vy_center**2 + vz_center**2) * 3.6
            
            # Acceleration
            ax = -350.0 * (0.04**2) * math.sin(0.04 * self.time_elapsed)
            ay = 0.0
            az = -12.0 * (0.025**2) * math.sin(0.025 * self.time_elapsed)
            
            # Compute WGS-84 Geodetic
            lat, lon, alt = enu_to_geodetic(true_pos[0], true_pos[1], true_pos[2])
            
            true_states[nid] = {
                "node_id": nid,
                "callsign": cfg.callsign,
                "role": cfg.role,
                "icao_hex": cfg.icao_hex,
                "timestamp": now,
                "seq": self.seq_counter,
                "pos_enu": list(true_pos),
                "true_pos_enu": list(true_pos),
                "vel_enu": list(true_vel),
                "accel_enu": [round(ax, 2), round(ay, 2), round(az, 2)],
                "speed_kmh": round(speed_kmh, 1),
                "heading": round(heading_deg, 1),
                "baro_alt": round(alt, 1),
                "lat": lat,
                "lon": lon,
                "alt": alt,
                "is_ghost": False
            }

        # 2. Extract ground truth positions for physical UWB ranging
        true_positions = {nid: true_states[nid]["true_pos_enu"] for nid in true_states}
        
        # 3. Simulate Adversarial Attack Mutations on reported telemetry
        reported_states = self.attack_manager.apply_attacks_to_swarm(true_states, dt)
        
        # If Ghost node was injected, add its true phantom position
        if self.attack_manager.ghost_injection_active and self.attack_manager.ghost_id in reported_states:
            true_positions[self.attack_manager.ghost_id] = reported_states[self.attack_manager.ghost_id]["true_pos_enu"]

        # 4. Measure Physical UWB Ranging Matrix (with KNN Sparsity & NLOS Rejection)
        active_node_ids = list(reported_states.keys())
        measured_uwb_matrix, resilience_metadata = self.ranging_engine.generate_ranging_matrix(
            active_node_ids, true_positions,
            packet_loss_rate=0.01,
            enforce_knn=True,
            simulate_multipath=True,
            simulate_jamming=False
        )
        
        # If Ghost node is phantom, its UWB links to physical drones return invalid/failed ranges (-1 or max error)
        if self.attack_manager.ghost_id in measured_uwb_matrix:
            for nid in active_node_ids:
                if nid != self.attack_manager.ghost_id:
                    measured_uwb_matrix[self.attack_manager.ghost_id][nid] = -1.0
                    measured_uwb_matrix[nid][self.attack_manager.ghost_id] = -1.0

        # 5. Run Byzantine Kinematic Spatial Consensus Engine
        consensus_result = self.consensus_engine.process_cycle(
            reported_states, measured_uwb_matrix, dt,
            is_rf_blackout=resilience_metadata.get("rf_blackout_active", False)
        )
        
        # 6. Merge consensus decisions back into node telemetry representations
        enriched_nodes: Dict[str, Any] = {}
        for nid, state in reported_states.items():
            status_info = consensus_result["node_statuses"].get(nid, {})
            
            # WGS-84 coordinates for reported vs estimated positions
            rep_lat, rep_lon, rep_alt = enu_to_geodetic(
                state["pos_enu"][0], state["pos_enu"][1], state["pos_enu"][2]
            )
            est_pos = status_info.get("estimated_pos_enu", state["pos_enu"])
            est_lat, est_lon, est_alt = enu_to_geodetic(
                est_pos[0], est_pos[1], est_pos[2]
            )
            
            enriched_nodes[nid] = {
                **state,
                "reported_lat": rep_lat,
                "reported_lon": rep_lon,
                "reported_alt": rep_alt,
                "estimated_lat": est_lat,
                "estimated_lon": est_lon,
                "estimated_alt": est_alt,
                "estimated_pos_enu": est_pos,
                "is_compromised": status_info.get("is_compromised", False),
                "is_isolated": status_info.get("is_isolated", False),
                "trust_score": status_info.get("trust_score", 100.0),
                "spatial_residual_m": status_info.get("spatial_residual_m", 0.0),
                "anomaly_flags": status_info.get("anomaly_flags", [])
            }

        return {
            "cycle": consensus_result["cycle"],
            "timestamp": now,
            "swarm_center_enu": [round(x, 1) for x in self.center_enu],
            "nodes": enriched_nodes,
            "ranging_matrix_uwb": measured_uwb_matrix,
            "pairwise_residuals": consensus_result["pairwise_residuals"],
            "spatial_residuals": consensus_result["spatial_residuals"],
            "quarantined_nodes": consensus_result["quarantined_nodes"],
            "consensus_block": consensus_result["consensus_block"],
            "attack_status": self.attack_manager.get_status(),
            "emergency_mode": self.emergency_mode,
            "telemetry_source": self.telemetry_source,
            "consensus_mode": consensus_result.get("consensus_mode", "NOMINAL_CONSENSUS"),
            "global_coordinated_spoof": consensus_result.get("global_coordinated_spoof", False),
            "resilience_metrics": resilience_metadata,
            "mavlink_status": self.mavlink_bridge.get_status(),
            "uwb_hardware_status": self.uwb_driver.get_status()
        }
