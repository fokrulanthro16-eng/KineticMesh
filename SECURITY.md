# Security & Vulnerability Disclosure Policy (VDP)

The **KineticMesh** project develops critical safety and cybersecurity infrastructure for autonomous unmanned aerial systems (UAS) operating in contested and GPS-denied environments. We treat the confidentiality, integrity, and operational availability of kinematic spatial consensus with the highest priority.

---

## 1. Scope of Coverage

This Vulnerability Disclosure Policy applies to the following components within the KineticMesh architecture:

- **Byzantine Kinematic Consensus Engine** (`backend/core/consensus.py`):
  - Spatial residual matrix computation algorithms
  - Multidimensional Scaling (MDS) and Levenberg-Marquardt multilateration fallover logic
  - Aerodynamic power envelope and kinematic invariant validators
  - Byzantine fault quorum and peer isolation routines
- **Physical Ranging & Topology Layer** (`backend/core/ranging.py`):
  - K-Nearest Neighbor (KNN) sparse mesh topology generators
  - NLOS / Multipath statistical reflection filters
  - RF jamming and electronic warfare blackout detection thresholds
- **Cryptographic Audit Chain** (`backend/core/consensus.py`, `backend/main.py`):
  - SHA-256 block hashing and Merkle tree root computation
  - Digital event attestation and tamper-evident ledger generation
- **Avionics & Hardware Bridges** (`backend/mavlink_bridge.py`, `backend/uwb_driver.py`):
  - MAVLink v2/v1 UDP packet deserialization (Buffer overflows, malformed packet injection)
  - Decawave DWM3000 serial UART driver abstraction
- **Tactical Avionics Cockpit UI** (`frontend/src/`):
  - WebSocket telemetry streaming endpoints (`/ws/telemetry`)
  - State manipulation vulnerabilities in command interfaces

---

## 2. Out-of-Scope Activities

The following activities are strictly prohibited and outside the scope of acceptable research:
- Over-the-air RF jamming or high-power GPS transmission in non-shielded / open airspaces without active regulatory authorization (FCC/FAA/EASA experimental license).
- Denial of Service (DoS/DDoS) attacks against production infrastructure or third-party cloud mirrors.
- Social engineering, phishing, or physical intrusion against project maintainers or physical test facilities.

---

## 3. Reporting a Vulnerability

If you discover a security flaw, cryptographic weakness, invariant bypass, or potential denial-of-service vulnerability in KineticMesh, please submit your findings directly to the core defense security team:

- **Primary Contact**: `fokrulanthro16@gmail.com`
- **Security Response Lead**: Fokrul Islam ([@fokrulanthro16-eng](https://github.com/fokrulanthro16-eng))
- **Encryption**: Please encrypt sensitive technical reports using our PGP public key (Fingerprint: `4B9A 2E81 D5F0 7C14 91A2 8B3F 02C4 8831 99F1 2A0E`).

### Report Format
To help us triage and resolve the issue quickly, include:
1. **Component**: Specific module, function, or file affected (e.g. `solve_dead_reckoning_multilateration` in `consensus.py`).
2. **Threat Vector**: Classification (e.g. Byzantine quorum poisoning, multipath filter bypass, meaconing sequence collision, DoS).
3. **Proof of Concept (PoC)**: Minimal reproducible script or packet capture demonstrating the invariant violation.
4. **Impact Assessment**: Estimated operational impact (e.g. single-drone deviation, false quarantine of honest nodes, ledger manipulation).

---

## 4. Response & Remediation SLA

We adhere to a coordinated, rapid-response vulnerability disclosure lifecycle:

| Phase | Target Timeline | Action |
|---|---|---|
| **Initial Acknowledgment** | **< 24 hours** | Confirmation of report receipt and initial risk classification. |
| **Triage & Reproduction** | **< 48 hours** | Engineering reproduction in simulated SITL or unit testbed. |
| **Patch Development** | **< 7 calendar days** | Release of patched invariant code and headless regression tests. |
| **Advisory & Release** | **Coordinated Disclosure** | Public release notes published alongside CVE designation (if applicable). |

---

## 5. Safe Harbor

Any security researcher who conducts research in good faith and in compliance with this policy is considered authorized, and we will not pursue legal action related to accidental or unintended security impacts arising from bona fide research.
