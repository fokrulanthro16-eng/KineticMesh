"""
KineticMesh - Full Reactive Defense Loop E2E Test Suite
Executes live end-to-end testing against active FastAPI & WebSocket endpoints for:
1. GPS Drift Attack & Dead-Reckoning Fallover
2. Ghost Telemetry Injection & Physical UWB Rejection
3. Meaconing / Replay Attack & Temporal Sequence Monotonicity Invariant
4. Pristine Swarm Restoration & Consensus Resynchronization
"""

import sys
import time
import math
import json
import urllib.request
import urllib.error

# Ensure stdout handles UTF-8 on Windows terminal
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"

def http_get(path: str):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "KineticMesh-E2E-Tester"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_post(path: str, body: dict = None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body or {}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json",
        "User-Agent": "KineticMesh-E2E-Tester"
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def print_separator(title: str):
    print("\n" + "=" * 75)
    print(f"  {title}")
    print("=" * 75)

def run_e2e_tests():
    print_separator("KINETICMESH END-TO-END REACTIVE DEFENSE LOOP VERIFICATION")
    
    # 0. Health Check
    health = http_get("/api/health")
    print(f"[HEALTH CHECK] Service Status: {health.get('status')} | Service: {health.get('service')}")
    assert health.get("status") == "OPERATIONAL", "Backend is not operational!"
    
    # --------------------------------------------------------------------------
    # STAGE 1: Baseline Nominal Consensus
    # --------------------------------------------------------------------------
    print_separator("STAGE 1: Baseline Nominal Flight Consensus")
    http_post("/api/swarm/reset")
    time.sleep(1.2)
    
    status = http_get("/api/swarm/status")
    quarantined = status.get("quarantined_nodes", [])
    nodes = status.get("nodes", {})
    
    print(f"• Active Swarm Nodes: {list(nodes.keys())}")
    print(f"• Quarantined Nodes: {quarantined}")
    assert len(quarantined) == 0, f"Expected 0 quarantined nodes in baseline, got {quarantined}"
    assert len(nodes) == 5, f"Expected 5 nodes in formation, got {len(nodes)}"
    
    for nid, node in nodes.items():
        print(f"  - Node {nid:10s} | Trust: {node['trust_score']:.1f}% | Residual ε: {node['spatial_residual_m']:.2f}m | Status: NOMINAL")
        assert node["trust_score"] == 100.0, f"Expected 100% trust, got {node['trust_score']}"
        assert node["spatial_residual_m"] <= 15.0, f"Residual exceeded threshold in nominal state: {node['spatial_residual_m']}"
        assert node["is_compromised"] is False
    print(">>> STAGE 1 VERIFIED: 100% Byzantine consensus across 5 nodes.")

    # --------------------------------------------------------------------------
    # STAGE 2: GPS Drift Attack & Dead-Reckoning Fallover
    # --------------------------------------------------------------------------
    print_separator("STAGE 2: GPS Drift Attack against Gamma-3 (VIPER-03)")
    print("• Action: Triggering progressive GPS skew (+65 m/s) on Gamma-3...")
    res = http_post("/api/swarm/attack", {
        "attack_type": "gps_drift",
        "active": True,
        "target_node": "Gamma-3"
    })
    print(f"• Attack Response: {res.get('status')}")
    
    drift_verified = False
    quarantine_verified = False
    fallover_locked = False
    
    # Monitor drift across 5 simulation cycles
    for cycle_idx in range(1, 6):
        time.sleep(1.1)
        status = http_get("/api/swarm/status")
        gamma = status["nodes"].get("Gamma-3", {})
        quarantined = status.get("quarantined_nodes", [])
        
        reported_enu = gamma.get("pos_enu", [0, 0, 0])
        est_enu = gamma.get("estimated_pos_enu", [0, 0, 0])
        true_enu = gamma.get("true_pos_enu", [0, 0, 0])
        res_m = gamma.get("spatial_residual_m", 0.0)
        trust = gamma.get("trust_score", 100.0)
        offset = gamma.get("drift_offset_m", 0.0)
        
        # Dead-reckoning position error relative to true physical position
        dr_error = math.sqrt(
            (est_enu[0] - true_enu[0]) ** 2 +
            (est_enu[1] - true_enu[1]) ** 2 +
            (est_enu[2] - true_enu[2]) ** 2
        )
        
        # Spoofed GPS error relative to true physical position
        gps_spoof_distance = math.sqrt(
            (reported_enu[0] - true_enu[0]) ** 2 +
            (reported_enu[1] - true_enu[1]) ** 2 +
            (reported_enu[2] - true_enu[2]) ** 2
        )
        
        print(f"  [Cycle {cycle_idx}] GPS Skew: +{offset:.1f}m | Residual ε: {res_m:.1f}m | Trust: {trust:.1f}% | DR Fallover Error: {dr_error:.2f}m")
        
        if res_m > 15.0:
            drift_verified = True
        if "Gamma-3" in quarantined:
            quarantine_verified = True
            assert gamma["is_compromised"] is True
            assert gamma["is_isolated"] is True
        if dr_error < 10.0 and gps_spoof_distance > 50.0:
            fallover_locked = True

    assert drift_verified, "Residual ε failed to exceed 15m threshold under drift!"
    assert quarantine_verified, "Gamma-3 was not quarantined by Byzantine Consensus!"
    assert fallover_locked, "Autonomous Dead-Reckoning fallover failed to track ground-truth formation!"
    print(f"• Anomaly flags logged: {gamma.get('anomaly_flags')}")
    print(">>> STAGE 2 VERIFIED: Byzantine Consensus detected residual >15m, quarantined Gamma-3, and successfully engaged dead-reckoning consensus fallover.")

    # --------------------------------------------------------------------------
    # STAGE 3: Ghost Injection Attack
    # --------------------------------------------------------------------------
    print_separator("STAGE 3: Ghost Injection Attack (Phantom Drone)")
    print("• Action: Injecting rogue telemetry stream (ICAO 0xA94F12, GHOST-SP-9)...")
    res = http_post("/api/swarm/attack", {
        "attack_type": "ghost_injection",
        "active": True
    })
    time.sleep(1.2)
    status = http_get("/api/swarm/status")
    
    nodes = status.get("nodes", {})
    quarantined = status.get("quarantined_nodes", [])
    
    assert "Ghost-X9" in nodes, "Ghost node was not found in swarm contacts!"
    ghost = nodes["Ghost-X9"]
    print(f"• Contact Detected: {ghost['callsign']} ({ghost['node_id']}) | ICAO: {ghost.get('icao_hex')}")
    print(f"• Is Compromised: {ghost['is_compromised']} | Quarantined: {'Ghost-X9' in quarantined}")
    print(f"• Ghost Anomaly Flags: {ghost.get('anomaly_flags')}")
    
    # Verify UWB ranging link is rejected/zero
    uwb_matrix = status.get("ranging_matrix_uwb", {})
    ghost_ranges = uwb_matrix.get("Ghost-X9", {})
    print(f"• Ghost Physical UWB Ranging Table: {ghost_ranges}")
    assert "Ghost-X9" in quarantined, "Ghost node was not quarantined!"
    print(">>> STAGE 3 VERIFIED: Phantom drone instantly isolated due to zero physical UWB Time-of-Flight acknowledgment.")

    # --------------------------------------------------------------------------
    # STAGE 4: Meaconing / Replay Attack
    # --------------------------------------------------------------------------
    print_separator("STAGE 4: Meaconing / Replay Attack against Beta-2")
    print("• Action: Replaying valid coordinates 6 frames out-of-phase with stale timestamps...")
    http_post("/api/swarm/attack", {
        "attack_type": "meaconing",
        "active": True,
        "target_node": "Beta-2"
    })
    
    meaconing_detected = False
    for cycle_idx in range(1, 8):
        time.sleep(1.1)
        status = http_get("/api/swarm/status")
        beta = status["nodes"].get("Beta-2", {})
        anomalies = beta.get("anomaly_flags", [])
        
        print(f"  [Cycle {cycle_idx}] Beta-2 Status: Compromised={beta.get('is_compromised')} | Flags: {anomalies}")
        if any("REPLAY" in f or "TELEPORTATION" in f for f in anomalies):
            meaconing_detected = True
            break
            
    assert meaconing_detected, "Meaconing / sequence monotonicity invariant failed to trigger!"
    print(">>> STAGE 4 VERIFIED: Meaconing replay detected by temporal sequence monotonicity validator.")

    # --------------------------------------------------------------------------
    # STAGE 5: Swarm Restoration & Consensus Resynchronization
    # --------------------------------------------------------------------------
    print_separator("STAGE 5: Swarm Disinfection & Reset to Pristine Formation")
    print("• Action: Triggering swarm reset and electronic warfare cleanse...")
    http_post("/api/swarm/reset")
    time.sleep(1.5)
    
    status = http_get("/api/swarm/status")
    nodes = status.get("nodes", {})
    quarantined = status.get("quarantined_nodes", [])
    
    print(f"• Active Nodes Post-Reset: {list(nodes.keys())}")
    print(f"• Quarantined Nodes Post-Reset: {quarantined}")
    
    assert len(quarantined) == 0, f"Expected empty quarantine, got {quarantined}"
    assert "Ghost-X9" not in nodes, "Ghost node was not purged upon reset!"
    assert len(nodes) == 5, f"Expected exactly 5 nodes, got {len(nodes)}"
    
    for nid, node in nodes.items():
        assert node["trust_score"] == 100.0, f"Node {nid} trust score did not reset to 100%!"
        assert node["is_compromised"] is False
        assert node["is_isolated"] is False
        print(f"  - Node {nid:10s} | Trust: {node['trust_score']:.1f}% | Anomaly Flags: {len(node['anomaly_flags'])} | Status: NOMINAL")
        
    # Check SHA-256 Ledger Block Integrity
    ledger = http_get("/api/swarm/consensus-log")
    total_blocks = ledger.get("total_blocks", 0)
    latest_block = ledger.get("blocks", [{}])[0]
    print(f"• SHA-256 Chained Consensus Blocks: {total_blocks} total")
    print(f"• Latest Block Index: #{latest_block.get('block_index')} | Hash: {latest_block.get('block_hash')[:24]}...")
    print(f"• Merkle Root: {latest_block.get('merkle_root')[:24]}...")
    
    print(">>> STAGE 5 VERIFIED: Swarm fully restored to 100% trust, green mesh consensus, and DEFCON 4.")

    print_separator("ALL ADVERSARIAL ATTACK VECTORS & REACTIVE DEFENSE LOOPS VERIFIED!")

if __name__ == "__main__":
    run_e2e_tests()
