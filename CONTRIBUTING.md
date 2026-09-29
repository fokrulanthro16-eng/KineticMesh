# Contributing to KineticMesh

Thank you for your interest in contributing to **KineticMesh**! This project is an open source defense-tech platform designed to safeguard autonomous unmanned aerial systems (UAS) operating in GPS-spoofed and contested electronic warfare airspaces.

We welcome contributions from cybersecurity researchers, aerospace engineers, roboticists, and software architects.

---

## 1. Core Architectural Invariants

Every contribution touching kinematics, ranging, or consensus **must adhere strictly to these 4 foundational pillars**:

### I. Zero-Trust Spatial Verification
- **External Satellite Telemetry is Untrusted by Default**: Never assume incoming GNSS/GPS coordinates are genuine without validating them against the peer UWB Time-of-Flight matrix.
- **Physical Ranging is Orthogonal**: Ultra-Wideband (UWB) Time-of-Flight ranging ($d_{ij} = c \cdot \Delta \tau / 2$) represents ground-truth physics that satellite radio spoofers cannot manipulate remotely.

### II. Monotonicity & Anti-Meaconing Invariants
- **Non-Decreasing Sequence Numbers**: Consecutive telemetry frames from any node must satisfy $\Delta \text{seq} > 0$.
- **Strictly Increasing Timestamp Clocks**: Telemetry intervals must satisfy $\Delta t > 0$. Stale or replayed packets must trigger immediate rejection.

### III. Aerodynamic & Inertial Work-Energy Bounds
- **Propulsion Power Envelope**: Instantaneous mechanical and aerodynamic power must not exceed maximum motor output:
  $$P_{\text{total}} = m \cdot \max(0, \mathbf{v} \cdot \mathbf{a}) + \frac{1}{2} \rho C_D A \|\mathbf{v}\|_2^3 \le 1800\text{ W}$$
- **Acceleration Limits**: Multirotor accelerations must remain within physical flight envelopes ($|\mathbf{a}| \le 40\text{ m/s}^2$).
- **Multi-Node Coordinated Translation**: Translating $\ge 3$ nodes simultaneously must trigger `GLOBAL_COORDINATED_SPOOF_ALERT`.

### IV. Byzantine Fault Tolerance (BFT)
- **Quorum Isolation**: A node is quarantined if a strict majority ($> 50\%$) of active peers vote distrust based on spatial residual violations ($\varepsilon > 15\text{ m}$) or kinematic failures.
- **Cryptographic Auditability**: Every consensus cycle must compute a deterministic Merkle root and chain into the SHA-256 ledger.

---

## 2. Development Setup

### Prerequisites
- **Python 3.11+** (FastAPI, NumPy, SciPy)
- **Node.js 18+** & **npm** (Next.js 15, React 19)
- **Git**

### Local Clone & Verification
```bash
git clone https://github.com/fokrulanthro16-eng/KineticMesh.git
cd KineticMesh

# 1. Verify Backend Unit & E2E Tests
cd backend
python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
python test_consensus.py
python e2e_attack_verification.py

# 2. Verify Frontend Compilation
cd ../frontend
npm install
npm run build
```

---

## 3. Pull Request Guidelines

1. **Branch Naming**:
   - `feat/feature-name` (New capability or driver interface)
   - `fix/bug-description` (Bugfix or numerical optimization)
   - `perf/optimization` (Mathematical or algorithmic performance improvement)
   - `docs/doc-update` (Documentation or specification refinement)

2. **Test Coverage**:
   - Any modification to `backend/core/` must pass both `test_consensus.py` and `e2e_attack_verification.py` with a **100% pass rate**.
   - Any new invariant check must include an automated attack mutation test verifying that both detection and autonomous fallover succeed.

3. **Commit Messages**:
   Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
   ```
   feat(consensus): implement adaptive RANSAC threshold for multipath rejection
   fix(multilateration): prevent singularity clamp overshoot under coplanar anchors
   docs(readme): add STANAG 4586 compliance attestation
   ```

4. **Code Quality**:
   - Python code must be typed and clean (`mypy`, PEP 8).
   - Frontend TypeScript must compile without errors (`npm run build`).

---

## 4. Code of Conduct

We are committed to providing a welcoming, inclusive, and professional environment. Harassment, discrimination, or abusive language will not be tolerated. All participants are expected to maintain professional standards of conduct in all project spaces.
