"""
KineticMesh - Adversarial Attack Injection Subsystem
Provides interactive attack vectors: Ghost Injection, GPS Drift Attack, and Meaconing / Replay Attack.
"""

import time
import math
import collections
from typing import Dict, Any, Optional, List


class AttackManager:
    """Manages dynamic attack scenarios injected against the autonomous swarm mesh."""

    def __init__(self):
        # Attack toggle states
        self.ghost_injection_active: bool = False
        self.gps_drift_active: bool = False
        self.meaconing_active: bool = False
        
        # GPS Drift Attack State (Targeting Gamma-3)
        self.drift_target_node: str = "Gamma-3"
        self.drift_start_time: float = 0.0
        self.drift_offset_meters: float = 0.0
        self.max_drift_meters: float = 2500.0  # 2.5 km off-course
        self.drift_rate_mps: float = 65.0       # 65 m/s skew rate
        self.drift_vector: List[float] = [1.0, 0.7, 0.2] # Direction in ENU
        
        # Ghost Node State
        self.ghost_id: str = "Ghost-X9"
        self.ghost_callsign: str = "GHOST-SP-9"
        self.ghost_icao: str = "0xA94F12"
        
        # Meaconing / Replay Attack State
        self.meaconing_target_node: str = "Beta-2"
        self.replay_buffer: collections.deque = collections.deque(maxlen=100) # Ring buffer of prior telemetry frames
        self.replay_delay_frames: int = 6  # Replay state from 6 frames ago

    def trigger_ghost_injection(self, active: bool = True):
        self.ghost_injection_active = active

    def trigger_gps_drift(self, active: bool = True, target: str = "Gamma-3"):
        self.gps_drift_active = active
        self.drift_target_node = target
        if active:
            self.drift_start_time = time.time()
            self.drift_offset_meters = 0.0
        else:
            self.drift_offset_meters = 0.0

    def trigger_meaconing(self, active: bool = True, target: str = "Beta-2"):
        self.meaconing_active = active
        self.meaconing_target_node = target
        if not active:
            self.replay_buffer.clear()

    def reset_all_attacks(self):
        self.ghost_injection_active = False
        self.gps_drift_active = False
        self.meaconing_active = False
        self.drift_offset_meters = 0.0
        self.replay_buffer.clear()

    def apply_attacks_to_swarm(
        self,
        node_states: Dict[str, Dict[str, Any]],
        dt: float = 1.0
    ) -> Dict[str, Dict[str, Any]]:
        """
        Mutates reported telemetry to simulate adversarial physical/RF interference.
        True physical position remains unpoisoned for simulation ground-truth reference.
        """
        # 1. Apply GPS Drift to target node (Gamma-3)
        if self.gps_drift_active and self.drift_target_node in node_states:
            self.drift_offset_meters = min(
                self.max_drift_meters,
                self.drift_offset_meters + (self.drift_rate_mps * dt)
            )
            target_state = node_states[self.drift_target_node]
            norm = math.sqrt(
                self.drift_vector[0]**2 + self.drift_vector[1]**2 + self.drift_vector[2]**2
            )
            dx = (self.drift_vector[0] / norm) * self.drift_offset_meters
            dy = (self.drift_vector[1] / norm) * self.drift_offset_meters
            dz = (self.drift_vector[2] / norm) * (self.drift_offset_meters * 0.1)
            
            # Corrupt the reported GPS position
            orig_enu = target_state["pos_enu"]
            target_state["pos_enu"] = [
                round(orig_enu[0] + dx, 2),
                round(orig_enu[1] + dy, 2),
                round(orig_enu[2] + dz, 2)
            ]
            # Reported velocity falsely drifts
            target_state["vel_enu"] = [
                target_state["vel_enu"][0] + (dx / max(1.0, dt)),
                target_state["vel_enu"][1] + (dy / max(1.0, dt)),
                target_state["vel_enu"][2]
            ]
            target_state["drift_offset_m"] = round(self.drift_offset_meters, 1)

        # 2. Record & Apply Meaconing / Replay Attack
        if self.meaconing_target_node in node_states:
            current_target = node_states[self.meaconing_target_node]
            # Copy snapshot into buffer
            self.replay_buffer.append({
                "pos_enu": list(current_target["pos_enu"]),
                "vel_enu": list(current_target["vel_enu"]),
                "seq": current_target["seq"],
                "timestamp": current_target["timestamp"]
            })
            
            if self.meaconing_active and len(self.replay_buffer) >= self.replay_delay_frames:
                # Inject delayed past telemetry with frozen/stale timestamps
                past_frame = self.replay_buffer[-self.replay_delay_frames]
                current_target["pos_enu"] = list(past_frame["pos_enu"])
                current_target["vel_enu"] = list(past_frame["vel_enu"])
                current_target["seq"] = past_frame["seq"] # Stale sequence counter
                current_target["timestamp"] = past_frame["timestamp"] # Non-monotonic timestamp!

        # 3. Apply Ghost Drone Injection
        if self.ghost_injection_active:
            # Ghost node reports plausible GPS coordinates near swarm center, but is phantom
            alpha_pos = node_states.get("Alpha-1", {}).get("pos_enu", [0, 0, 100])
            node_states[self.ghost_id] = {
                "node_id": self.ghost_id,
                "callsign": self.ghost_callsign,
                "timestamp": time.time(),
                "seq": 9999,
                "pos_enu": [
                    alpha_pos[0] + 45.0,
                    alpha_pos[1] - 80.0,
                    alpha_pos[2] + 15.0
                ],
                "true_pos_enu": [-9999.0, -9999.0, -9999.0], # Has NO physical body in the airspace!
                "vel_enu": [18.0, 22.0, 0.0],
                "accel_enu": [0.0, 0.0, 0.0],
                "speed_kmh": 102.5,
                "heading": 38.0,
                "baro_alt": alpha_pos[2] + 65.0, # Gross barometric divergence
                "lat": 34.9060,
                "lon": -117.8830,
                "alt": 780.0,
                "is_ghost": True,
                "icao_hex": self.ghost_icao
            }

        return node_states

    def get_status(self) -> Dict[str, Any]:
        return {
            "ghost_injection": {
                "active": self.ghost_injection_active,
                "ghost_id": self.ghost_id,
                "icao": self.ghost_icao
            },
            "gps_drift": {
                "active": self.gps_drift_active,
                "target_node": self.drift_target_node,
                "offset_meters": round(self.drift_offset_meters, 1),
                "max_drift_meters": self.max_drift_meters
            },
            "meaconing": {
                "active": self.meaconing_active,
                "target_node": self.meaconing_target_node,
                "delay_frames": self.replay_delay_frames
            }
        }
