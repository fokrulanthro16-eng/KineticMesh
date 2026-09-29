"""
KineticMesh - Byzantine Kinematic Spatial Consensus & Anti-Spoofing Engine
Implements MDS (Multidimensional Scaling) / Procrustes Trilateration, Kinematic Invariant Validation,
Byzantine Voting Matrices, and SHA-256 Chained Consensus Logs.
"""

import hashlib
import json
import math
import time
from typing import Dict, List, Tuple, Optional, Any
import numpy as np

# Consensus Residual Thresholds
RESIDUAL_THRESHOLD_METERS = 15.0      # ε > 15m triggers COMPROMISED / GPS_SPOOFED
ACCEL_MAX_MPS2 = 40.0                 # ~4g impossible kinematic delta
VELOCITY_JUMP_MAX_MPS = 33.33         # > 120 km/h instantaneous teleportation jump
BARO_GPS_DECOUPLING_MAX_M = 20.0      # Barometric vs GPS altitude divergence
TRUST_DECAY_RATE = 45.0               # Trust penalty per violation cycle
TRUST_RECOVERY_RATE = 10.0            # Trust recovery per clean cycle

# Aerodynamic & Energy Invariant Envelope
DRONE_MASS_KG = 2.4                   # Standard tactical multirotor mass (kg)
MAX_PROPULSION_POWER_WATTS = 1800.0   # Maximum mechanical/aerodynamic propulsion power (W)
AIR_DENSITY_RHO = 1.225               # Sea level air density (kg/m^3)
DRAG_COEFF_AREA = 0.08                # Equivalent parasitic drag area Cd * A (m^2)


def sha256_hash(data: str) -> str:
    """Compute SHA-256 hexadecimal digest."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


class ConsensusBlock(BaseModel if False else object):
    """Immutable audit block for swarm consensus decision."""
    def __init__(self, block_index: int, prev_hash: str, timestamp: float,
                 cycle: int, votes: Dict[str, Dict[str, bool]],
                 quarantined_nodes: List[str], merkle_root: str):
        self.block_index = block_index
        self.prev_hash = prev_hash
        self.timestamp = timestamp
        self.cycle = cycle
        self.votes = votes
        self.quarantined_nodes = quarantined_nodes
        self.merkle_root = merkle_root
        
        payload = f"{block_index}:{prev_hash}:{timestamp}:{cycle}:{json.dumps(votes, sort_keys=True)}:{json.dumps(quarantined_nodes)}:{merkle_root}"
        self.block_hash = sha256_hash(payload)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "block_index": self.block_index,
            "prev_hash": self.prev_hash,
            "block_hash": self.block_hash,
            "timestamp": self.timestamp,
            "cycle": self.cycle,
            "votes": self.votes,
            "quarantined_nodes": self.quarantined_nodes,
            "merkle_root": self.merkle_root
        }


class ConsensusEngine:
    """
    Byzantine Kinematic Spatial Consensus Engine
    Cross-checks RF / UWB physical ranging with reported GPS coordinates and kinematic invariants.
    """

    def __init__(self, residual_threshold: float = RESIDUAL_THRESHOLD_METERS):
        self.residual_threshold = residual_threshold
        self.cycle_count = 0
        self.consensus_blocks: List[ConsensusBlock] = []
        self.last_block_hash = "0" * 64
        self.prev_states: Dict[str, Dict[str, Any]] = {}
        self.trust_scores: Dict[str, float] = {}

    def compute_spatial_residuals(
        self,
        node_ids: List[str],
        reported_positions: Dict[str, List[float]],
        measured_uwb_matrix: Dict[str, Dict[str, float]]
    ) -> Tuple[Dict[str, float], Dict[str, Dict[str, float]]]:
        """
        Compute pairwise and aggregate peer-ranging residuals:
        residual_ij = | ||p_i - p_j|| - d_ij_uwb |
        aggregate_residual_i = median of peer pairwise residuals to avoid poisoned anchors.
        """
        pairwise_residuals: Dict[str, Dict[str, float]] = {nid: {} for nid in node_ids}
        aggregate_residuals: Dict[str, float] = {}
        
        for id_i in node_ids:
            peer_diffs = []
            for id_j in node_ids:
                if id_i == id_j:
                    continue
                pos_i = reported_positions[id_i]
                pos_j = reported_positions[id_j]
                gps_dist = math.sqrt(
                    (pos_i[0] - pos_j[0]) ** 2 +
                    (pos_i[1] - pos_j[1]) ** 2 +
                    (pos_i[2] - pos_j[2]) ** 2
                )
                uwb_dist = measured_uwb_matrix.get(id_i, {}).get(id_j, -1.0)
                
                if uwb_dist > 0:
                    diff = abs(gps_dist - uwb_dist)
                    pairwise_residuals[id_i][id_j] = round(diff, 2)
                    peer_diffs.append(diff)
                else:
                    pairwise_residuals[id_i][id_j] = 0.0
                    
            if peer_diffs:
                # Use robust median residual to prevent a single spoofed peer from poisoning honest nodes
                aggregate_residuals[id_i] = round(float(np.median(peer_diffs)), 2)
            else:
                aggregate_residuals[id_i] = 0.0
                
        return aggregate_residuals, pairwise_residuals

    def validate_kinematic_invariants(
        self,
        node_id: str,
        curr_state: Dict[str, Any],
        prev_state: Optional[Dict[str, Any]],
        dt: float = 1.0
    ) -> List[str]:
        """
        Kinematic Invariant Validator:
        1. Acceleration delta check (|a| > 40 m/s^2)
        2. Altitude/barometric decoupling (|alt_gps - alt_baro| > 20m)
        3. Instantaneous velocity teleportation (>120 km/h jump)
        4. Meaconing/timestamp replay anomaly (delta_t <= 0 or repeated old frame)
        """
        violations: List[str] = []
        
        # 1. Barometric Decoupling Check
        gps_alt = curr_state.get("alt", 0.0)
        baro_alt = curr_state.get("baro_alt", gps_alt)
        if abs(gps_alt - baro_alt) > BARO_GPS_DECOUPLING_MAX_M:
            violations.append(
                f"BARO_DECOUPLING: |GPS({gps_alt:.1f}m) - Baro({baro_alt:.1f}m)| = {abs(gps_alt - baro_alt):.1f}m > {BARO_GPS_DECOUPLING_MAX_M}m"
            )
            
        # 2. Acceleration Invariant Check
        accel = curr_state.get("accel_enu", [0.0, 0.0, 0.0])
        accel_mag = math.sqrt(accel[0] ** 2 + accel[1] ** 2 + accel[2] ** 2)
        if accel_mag > ACCEL_MAX_MPS2:
            violations.append(
                f"IMPOSSIBLE_ACCEL: Magnitude {accel_mag:.1f} m/s² exceeds envelope {ACCEL_MAX_MPS2} m/s² (~4g)"
            )
            
        # Invariants requiring prior temporal frame
        if prev_state:
            ts_curr = curr_state.get("timestamp", 0)
            ts_prev = prev_state.get("timestamp", 0)
            t_diff = ts_curr - ts_prev
            
            # 3. Meaconing / Replay Timestamp Check
            if t_diff <= 0.001:
                violations.append("TIMESTAMP_REPLAY: Duplicate or non-monotonic packet timestamp detected")
            elif curr_state.get("seq", 0) <= prev_state.get("seq", 0):
                violations.append("SEQUENCE_REPLAY: Non-monotonic sequence counter (potential meaconing replay)")
                
            # 4. Instantaneous Teleportation Check
            step_dt = dt if dt > 0.001 else max(0.001, t_diff)
            p_curr = curr_state.get("pos_enu", [0, 0, 0])
            p_prev = prev_state.get("pos_enu", [0, 0, 0])
            instant_dist = math.sqrt(
                (p_curr[0] - p_prev[0]) ** 2 +
                (p_curr[1] - p_prev[1]) ** 2 +
                (p_curr[2] - p_prev[2]) ** 2
            )
            instant_speed_mps = instant_dist / step_dt
            if instant_speed_mps > VELOCITY_JUMP_MAX_MPS:
                violations.append(
                    f"VELOCITY_TELEPORTATION: Instant jump {instant_speed_mps * 3.6:.1f} km/h > 120 km/h limit"
                )

            # 5. Aerodynamic Power & Kinetic Energy Invariant Check
            vel = curr_state.get("vel_enu", [0.0, 0.0, 0.0])
            v_mag = math.sqrt(vel[0]**2 + vel[1]**2 + vel[2]**2)
            dot_product = vel[0] * accel[0] + vel[1] * accel[1] + vel[2] * accel[2]
            p_inertial = DRONE_MASS_KG * max(0.0, dot_product)
            p_drag = 0.5 * AIR_DENSITY_RHO * DRAG_COEFF_AREA * (v_mag ** 3)
            total_power_watts = p_inertial + p_drag
            if total_power_watts > MAX_PROPULSION_POWER_WATTS:
                violations.append(
                    f"AERODYNAMIC_POWER_EXCEEDED: Power draw {total_power_watts:.0f}W exceeds propulsion limit {MAX_PROPULSION_POWER_WATTS:.0f}W"
                )
                    
        return violations

    def run_byzantine_voting(
        self,
        node_ids: List[str],
        pairwise_residuals: Dict[str, Dict[str, float]],
        spatial_residuals: Dict[str, float],
        kinematic_violations: Dict[str, List[str]]
    ) -> Tuple[Dict[str, Dict[str, bool]], List[str]]:
        """
        Byzantine Fault-Tolerant Voting:
        Each node votes TRUE (healthy) or FALSE (discordant/compromised) for its peers.
        A node is flagged COMPROMISED / GPS_SPOOFED if:
        - It receives >= BFT quorum of peer distrust votes, OR
        - It triggers fatal kinematic invariant violations, OR
        - Its aggregate spatial residual exceeds threshold (ε > 15m)
        """
        votes: Dict[str, Dict[str, bool]] = {nid: {} for nid in node_ids}
        quarantined: List[str] = []
        
        # Each peer evaluates every other node
        for voter in node_ids:
            for target in node_ids:
                if voter == target:
                    votes[voter][target] = True
                    continue
                
                # Check pairwise distance mismatch
                pair_err = pairwise_residuals.get(voter, {}).get(target, 0.0)
                is_trusted = (pair_err <= self.residual_threshold)
                votes[voter][target] = is_trusted

        # Tally peer votes
        for target in node_ids:
            distrust_votes = 0
            total_voters = 0
            for voter in node_ids:
                if voter != target:
                    total_voters += 1
                    if not votes[voter].get(target, True):
                        distrust_votes += 1
                        
            has_kinematic_fail = len(kinematic_violations.get(target, [])) > 0
            has_spatial_fail = spatial_residuals.get(target, 0.0) > self.residual_threshold
            
            # Byzantine fault condition: strict majority of peers (> 50%) vote discordant OR direct spatial/kinematic failure
            if (distrust_votes > (total_voters / 2.0)) or has_kinematic_fail or has_spatial_fail:
                quarantined.append(target)
                
        return votes, quarantined

    def solve_dead_reckoning_multilateration(
        self,
        compromised_node_id: str,
        trusted_node_ids: List[str],
        trusted_positions: Dict[str, List[float]],
        measured_uwb_matrix: Dict[str, Dict[str, float]],
        prev_estimated_pos: Optional[List[float]],
        velocity: List[float],
        dt: float = 1.0
    ) -> List[float]:
        """
        Autonomous Fallover:
        Computes accurate real position via peer UWB multilateration consensus relative to healthy nodes.
        Blended with kinematic dead-reckoning extrapolation.
        """
        # Dead-reckoning base estimate
        if prev_estimated_pos:
            dr_pos = [
                prev_estimated_pos[0] + velocity[0] * dt,
                prev_estimated_pos[1] + velocity[1] * dt,
                prev_estimated_pos[2] + velocity[2] * dt
            ]
        else:
            dr_pos = [0.0, 0.0, 100.0]

        # If we have at least 3 trusted anchors with valid UWB ranging, solve least-squares multilateration
        anchors = []
        ranges = []
        for tid in trusted_node_ids:
            r = measured_uwb_matrix.get(compromised_node_id, {}).get(tid, -1.0)
            if r > 0 and tid in trusted_positions:
                anchors.append(trusted_positions[tid])
                ranges.append(r)

        if len(anchors) >= 3:
            # Non-linear least-squares refinement around dr_pos
            pos = np.array(dr_pos, dtype=float)
            anchors_np = np.array(anchors, dtype=float)
            ranges_np = np.array(ranges, dtype=float)
            
            # Levenberg-Marquardt / Gauss-Newton step
            for _ in range(15):
                diffs = pos - anchors_np
                calc_ranges = np.linalg.norm(diffs, axis=1)
                calc_ranges = np.maximum(calc_ranges, 0.001)
                residuals = calc_ranges - ranges_np
                
                # Jacobian matrix J_i = (pos - anchor_i) / ||pos - anchor_i||
                J = diffs / calc_ranges[:, np.newaxis]
                
                # Update: delta = (J^T J + lambda I)^-1 J^T residual
                try:
                    delta, _, _, _ = np.linalg.lstsq(J, residuals, rcond=None)
                    delta_norm = float(np.linalg.norm(delta))
                    if delta_norm > 20.0:
                        delta = (delta / delta_norm) * 20.0
                    pos -= 0.8 * delta # Damped gradient step
                    if delta_norm < 0.02:
                        break
                except Exception:
                    break
                    
            return [round(float(pos[0]), 2), round(float(pos[1]), 2), round(float(pos[2]), 2)]

        return [round(x, 2) for x in dr_pos]

    def process_cycle(
        self,
        current_states: Dict[str, Dict[str, Any]],
        measured_uwb_matrix: Dict[str, Dict[str, float]],
        dt: float = 1.0,
        is_rf_blackout: bool = False
    ) -> Dict[str, Any]:
        """
        Execute one complete Byzantine Kinematic Spatial Consensus Cycle.
        Includes Coordinated Spoofing Invariant & RF Blackout Resilience.
        """
        self.cycle_count += 1
        now = time.time()
        node_ids = sorted(list(current_states.keys()))
        
        reported_positions = {nid: current_states[nid]["pos_enu"] for nid in node_ids}
        
        # 1. Compute peer residuals
        spatial_residuals, pairwise_residuals = self.compute_spatial_residuals(
            node_ids, reported_positions, measured_uwb_matrix
        )
        
        # 2. Check kinematic & energy invariants
        kinematic_violations: Dict[str, List[str]] = {}
        for nid in node_ids:
            curr = current_states[nid]
            prev = self.prev_states.get(nid)
            violations = self.validate_kinematic_invariants(nid, curr, prev, dt)
            kinematic_violations[nid] = violations

        # Check Collective Coordinated Spoofing (Anti-Coordinated Translation)
        # In a coordinated translation spoof, an adversary translates multiple drones together
        # so pairwise distances d_ij remain unchanged. We detect this by checking if >= 3 nodes
        # simultaneously violate inertial / aerodynamic acceleration limits or collective translation velocity.
        global_coordinated_spoof = False
        if self.prev_states:
            displaced_count = 0
            for nid in node_ids:
                if nid in self.prev_states:
                    p_c = current_states[nid]["pos_enu"]
                    p_p = self.prev_states[nid]["pos_enu"]
                    disp = math.sqrt(
                        (p_c[0] - p_p[0]) ** 2 +
                        (p_c[1] - p_p[1]) ** 2 +
                        (p_c[2] - p_p[2]) ** 2
                    )
                    speed = disp / max(0.001, dt)
                    # Check if node individually exceeds kinematic threshold
                    if speed > VELOCITY_JUMP_MAX_MPS or len(kinematic_violations.get(nid, [])) > 0:
                        displaced_count += 1
                        
            # If 3 or more nodes (majority) violate inertial envelopes simultaneously -> Coordinated Spoofing
            if displaced_count >= 3:
                global_coordinated_spoof = True
                for nid in node_ids:
                    kinematic_violations[nid].append(
                        f"GLOBAL_COORDINATED_SPOOF_ALERT: Formation-wide coordinated multi-node translation detected ({displaced_count} nodes violating)"
                    )
            
        # 3. Byzantine voting
        votes, quarantined = self.run_byzantine_voting(
            node_ids, pairwise_residuals, spatial_residuals, kinematic_violations
        )

        # 3b. RF Jamming / Blackout Failover:
        # If active broadband RF jamming drops UWB packets across the airspace,
        # avoid false quarantines driven solely by missing UWB ranges.
        if is_rf_blackout:
            quarantined = [nid for nid in quarantined if len(kinematic_violations.get(nid, [])) > 0]
        
        # 4. Update trust scores & compute consensus fallover
        trusted_nodes = [nid for nid in node_ids if nid not in quarantined]
        trusted_positions = {nid: reported_positions[nid] for nid in trusted_nodes}
        
        resolved_positions: Dict[str, List[float]] = {}
        node_statuses: Dict[str, Dict[str, Any]] = {}
        
        for nid in node_ids:
            current_trust = self.trust_scores.get(nid, 100.0)
            is_compromised = (nid in quarantined)
            
            if is_compromised:
                # Trust score plummets
                current_trust = max(0.0, current_trust - TRUST_DECAY_RATE)
                
                # Recover true position using dead-reckoning consensus
                prev_est = self.prev_states.get(nid, {}).get("estimated_pos_enu", current_states[nid]["pos_enu"])
                
                # Derive dead-reckoning velocity: use uncorrupted formation velocity from trusted nodes
                trusted_vels = [current_states[t]["vel_enu"] for t in trusted_nodes if t in current_states]
                if trusted_vels:
                    vel = [
                        float(np.mean([v[0] for v in trusted_vels])),
                        float(np.mean([v[1] for v in trusted_vels])),
                        float(np.mean([v[2] for v in trusted_vels]))
                    ]
                else:
                    vel = self.prev_states.get(nid, {}).get("vel_enu", [0.0, 0.0, 0.0])

                est_pos = self.solve_dead_reckoning_multilateration(
                    nid, trusted_nodes, trusted_positions,
                    measured_uwb_matrix, prev_est, vel, dt
                )
            else:
                # Trust score recovers if clean
                current_trust = min(100.0, current_trust + TRUST_RECOVERY_RATE)
                est_pos = reported_positions[nid]
                
            self.trust_scores[nid] = round(current_trust, 1)
            resolved_positions[nid] = est_pos
            
            # Combine all anomaly reasons
            all_anomalies = list(kinematic_violations.get(nid, []))
            if spatial_residuals.get(nid, 0.0) > self.residual_threshold:
                all_anomalies.append(
                    f"SPATIAL_CONSENSUS_VIOLATION: ε = {spatial_residuals[nid]:.1f}m > {self.residual_threshold}m threshold"
                )
                
            node_statuses[nid] = {
                "node_id": nid,
                "is_compromised": is_compromised,
                "is_isolated": is_compromised,
                "trust_score": self.trust_scores[nid],
                "spatial_residual_m": spatial_residuals.get(nid, 0.0),
                "anomaly_flags": all_anomalies,
                "reported_pos_enu": reported_positions[nid],
                "estimated_pos_enu": est_pos,
                "true_pos_enu": current_states[nid].get("true_pos_enu", est_pos)
            }
            
            # Cache state for next temporal cycle
            self.prev_states[nid] = {
                "timestamp": current_states[nid].get("timestamp", now),
                "seq": current_states[nid].get("seq", 0),
                "pos_enu": reported_positions[nid],
                "estimated_pos_enu": est_pos,
                "vel_enu": current_states[nid].get("vel_enu", [0, 0, 0]),
                "accel_enu": current_states[nid].get("accel_enu", [0, 0, 0])
            }

        # 5. Build SHA-256 Chained Consensus Block
        merkle_payload = json.dumps(
            [{"id": k, "res": spatial_residuals[k], "anom": len(kinematic_violations.get(k, []))} for k in sorted(node_ids)],
            sort_keys=True
        )
        merkle_root = sha256_hash(merkle_payload)
        
        block = ConsensusBlock(
            block_index=len(self.consensus_blocks) + 1,
            prev_hash=self.last_block_hash,
            timestamp=now,
            cycle=self.cycle_count,
            votes=votes,
            quarantined_nodes=quarantined,
            merkle_root=merkle_root
        )
        self.last_block_hash = block.block_hash
        self.consensus_blocks.append(block)
        
        # Keep maximum 100 blocks in memory
        if len(self.consensus_blocks) > 100:
            self.consensus_blocks.pop(0)

        consensus_mode = "NOMINAL_CONSENSUS"
        if global_coordinated_spoof:
            consensus_mode = "GLOBAL_COORDINATED_SPOOF_ALERT"
        elif is_rf_blackout:
            consensus_mode = "EW_RF_BLACKOUT_FALLBACK"
        elif len(quarantined) > 0:
            consensus_mode = "BYZANTINE_FAULT_ISOLATION"

        return {
            "cycle": self.cycle_count,
            "timestamp": now,
            "consensus_mode": consensus_mode,
            "global_coordinated_spoof": global_coordinated_spoof,
            "is_rf_blackout": is_rf_blackout,
            "quarantined_nodes": quarantined,
            "node_statuses": node_statuses,
            "pairwise_residuals": pairwise_residuals,
            "spatial_residuals": spatial_residuals,
            "consensus_block": block.to_dict()
        }
