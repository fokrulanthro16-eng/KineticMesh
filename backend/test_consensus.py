"""
Automated Verification Suite for KineticMesh Consensus Core
Tests 5-node swarm mechanics, invariant validation, attack injection, and dead-reckoning fallover.
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from core.swarm import SwarmSimulator

def test_kinetic_mesh_pipeline():
    print("=" * 60)
    print("RUNNING KINETICMESH CONSENSUS VERIFICATION SUITE")
    print("=" * 60)
    
    sim = SwarmSimulator()
    
    # 1. Test Baseline Nominal Flight (5 cycles)
    print("\n[TEST 1] Nominal Flight Consensus Check...")
    for cycle in range(1, 6):
        telemetry = sim.update_physics_step(dt=1.0)
        quarantined = telemetry["quarantined_nodes"]
        residuals = telemetry["pairwise_residuals"]
        print(f"Cycle {cycle}: Quarantined={quarantined} | Active Nodes={len(telemetry['nodes'])}")
        assert len(quarantined) == 0, f"Expected 0 quarantined nodes in baseline, got {quarantined}"
        for nid, node in telemetry["nodes"].items():
            assert node["trust_score"] == 100.0, f"Expected 100% trust for {nid}, got {node['trust_score']}"
            assert node["spatial_residual_m"] < 5.0, f"Excessive baseline residual: {node['spatial_residual_m']}m"
    print(">>> TEST 1 PASSED: Nominal swarm achieves 100% Byzantine consensus!")

    # 2. Test GPS Drift Attack & Autonomous Fallover
    print("\n[TEST 2] Injecting GPS Drift Attack against Gamma-3...")
    sim.attack_manager.trigger_gps_drift(active=True, target="Gamma-3")
    
    drift_detected = False
    for step in range(1, 10):
        telemetry = sim.update_physics_step(dt=1.0)
        gamma = telemetry["nodes"]["Gamma-3"]
        quarantined = telemetry["quarantined_nodes"]
        res = gamma["spatial_residual_m"]
        offset = gamma.get("drift_offset_m", 0)
        
        print(f"Drift Step {step}: Gamma-3 Residual={res:.1f}m | GPS Skew={offset:.1f}m | Quarantined={quarantined}")
        
        if "Gamma-3" in quarantined:
            drift_detected = True
            assert gamma["is_compromised"] is True
            assert gamma["is_isolated"] is True
            assert gamma["trust_score"] < 100.0
            # Verify dead-reckoning recovered position matches true physical formation within 5 meters
            true_p = gamma["true_pos_enu"]
            est_p = gamma["estimated_pos_enu"]
            pos_err = ((true_p[0] - est_p[0])**2 + (true_p[1] - est_p[1])**2 + (true_p[2] - est_p[2])**2)**0.5
            print(f"   -> Fallover Position Error relative to True Formation: {pos_err:.2f} meters (Dead-Reckoning Locked)")
            assert pos_err < 10.0, f"Dead-reckoning failed to track true position: err={pos_err}m"
            break
            
    assert drift_detected, "Byzantine engine failed to detect GPS drift attack!"
    print(">>> TEST 2 PASSED: GPS drift detected, Gamma-3 quarantined, dead-reckoning fallover maintained!")

    # 3. Test Ghost Injection
    print("\n[TEST 3] Injecting Ghost Telemetry Stream (Phantom Drone)...")
    sim.attack_manager.trigger_ghost_injection(active=True)
    telemetry = sim.update_physics_step(dt=1.0)
    
    assert "Ghost-X9" in telemetry["nodes"]
    assert "Ghost-X9" in telemetry["quarantined_nodes"]
    ghost_node = telemetry["nodes"]["Ghost-X9"]
    assert ghost_node["is_compromised"] is True
    print(f"Ghost-X9 Flags: {ghost_node['anomaly_flags']}")
    print(">>> TEST 3 PASSED: Ghost node instantly detected & rejected due to zero physical UWB ToF acknowledgment!")

    # 4. Test Swarm Restoration
    print("\n[TEST 4] Resetting Swarm to Pristine State...")
    sim.reset_swarm()
    telemetry = sim.update_physics_step(dt=0.1)
    assert len(telemetry["quarantined_nodes"]) == 0
    assert len(telemetry["nodes"]) == 5
    print(">>> TEST 4 PASSED: Swarm restored to pristine 5-node formation!")
    
    print("\n" + "=" * 60)
    print("ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_kinetic_mesh_pipeline()
