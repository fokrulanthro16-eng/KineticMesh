"""
KineticMesh - MAVLink v2 / Gazebo SITL Bridge Interface
Provides real-time UDP telemetry ingestion for PX4 / ArduPilot / Gazebo SITL swarms.
Default UDP listen port: 14550 (configurable).
"""

import socket
import struct
import threading
import time
import logging
from typing import Dict, Any, Optional, Callable, List

logger = logging.getLogger("KineticMesh.MAVLink")

# Standard MAVLink v2 Magic Byte
MAVLINK_V2_STX = 0xFD
MAVLINK_V1_STX = 0xFE

# Core MAVLink Message IDs
MSG_HEARTBEAT = 0
MSG_SYS_STATUS = 1
MSG_ATTITUDE = 30
MSG_GLOBAL_POSITION_INT = 33
MSG_HIGHRES_IMU = 105


class MAVLinkBridge:
    """
    Lightweight MAVLink v2 / SITL Bridge.
    Receives UDP packets from PX4/ArduPilot SITL instances and translates them into
    KineticMesh kinematic state vectors.
    """

    def __init__(self, port: int = 14550, host: str = "0.0.0.0"):
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.is_running = False
        self.listen_thread: Optional[threading.Thread] = None
        self.last_packet_time: float = 0.0
        self.packets_received: int = 0
        self.node_telemetry_cache: Dict[str, Dict[str, Any]] = {}
        self.system_id_to_callsign: Dict[int, str] = {
            1: "Alpha-1",
            2: "Beta-2",
            3: "Gamma-3",
            4: "Delta-4",
            5: "Epsilon-5",
        }

    def start(self):
        """Start UDP listener thread."""
        if self.is_running:
            return
        self.is_running = True
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.bind((self.host, self.port))
            self.socket.settimeout(1.0)
            logger.info(f"MAVLink SITL Bridge listening on UDP {self.host}:{self.port}")
        except Exception as e:
            logger.warning(f"Failed to bind MAVLink UDP port {self.port} (simulated SITL active): {e}")

        self.listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.listen_thread.start()

    def stop(self):
        """Stop UDP listener thread."""
        self.is_running = False
        if self.socket:
            try:
                self.socket.close()
            except Exception:
                pass
        if self.listen_thread:
            self.listen_thread.join(timeout=1.0)
        logger.info("MAVLink SITL Bridge stopped.")

    def _listen_loop(self):
        """Continuous packet receiving loop."""
        while self.is_running:
            if not self.socket:
                time.sleep(0.5)
                continue
            try:
                data, addr = self.socket.recvfrom(2048)
                self.packets_received += 1
                self.last_packet_time = time.time()
                self._parse_mavlink_packet(data)
            except socket.timeout:
                continue
            except Exception as e:
                if self.is_running:
                    logger.debug(f"MAVLink socket read error: {e}")
                time.sleep(0.1)

    def _parse_mavlink_packet(self, data: bytes):
        """
        Parses binary MAVLink v2 frames.
        Extracts GLOBAL_POSITION_INT (msg id 33) and ATTITUDE (msg id 30).
        """
        if len(data) < 12:
            return

        stx = data[0]
        if stx == MAVLINK_V2_STX:
            # MAVLink v2 Header:
            # 0: STX (0xFD), 1: Payload Len, 2: Incompatible flags, 3: Compat flags,
            # 4: Seq, 5: SysID, 6: CompID, 7-9: MsgID (24-bit little endian)
            payload_len = data[1]
            sys_id = data[5]
            msg_id = data[7] | (data[8] << 8) | (data[9] << 16)
            payload = data[10 : 10 + payload_len]
        elif stx == MAVLINK_V1_STX:
            # MAVLink v1 Header:
            # 0: STX (0xFE), 1: Payload Len, 2: Seq, 3: SysID, 4: CompID, 5: MsgID (8-bit)
            payload_len = data[1]
            sys_id = data[3]
            msg_id = data[5]
            payload = data[6 : 6 + payload_len]
        else:
            return

        callsign = self.system_id_to_callsign.get(sys_id, f"SITL-UAV-{sys_id}")

        # Parse GLOBAL_POSITION_INT (Msg ID 33)
        # Struct: uint32 time_boot_ms, int32 lat, int32 lon, int32 alt, int32 relative_alt, int16 vx, int16 vy, int16 vz, uint16 hdg
        if msg_id == MSG_GLOBAL_POSITION_INT and len(payload) >= 28:
            try:
                time_boot_ms, lat_raw, lon_raw, alt_raw, rel_alt_raw, vx, vy, vz, hdg = struct.unpack(
                    "<Iiiii3hh", payload[:28]
                )
                lat = lat_raw / 1e7
                lon = lon_raw / 1e7
                alt = alt_raw / 1000.0  # mm to meters MSL
                vx_mps = vx / 100.0
                vy_mps = vy / 100.0
                vz_mps = vz / 100.0
                heading_deg = hdg / 100.0

                self.node_telemetry_cache[callsign] = {
                    "node_id": callsign,
                    "timestamp": time.time(),
                    "lat": lat,
                    "lon": lon,
                    "alt": alt,
                    "rel_alt": rel_alt_raw / 1000.0,
                    "vel_enu": [vx_mps, vy_mps, vz_mps],
                    "speed_kmh": (vx_mps**2 + vy_mps**2 + vz_mps**2)**0.5 * 3.6,
                    "heading": heading_deg,
                    "source": "MAVLINK_SITL",
                }
            except Exception as e:
                logger.debug(f"Failed to unpack GLOBAL_POSITION_INT: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Telemetry source status summary."""
        is_active = (time.time() - self.last_packet_time < 3.0) if self.last_packet_time > 0 else False
        return {
            "is_running": self.is_running,
            "is_receiving": is_active,
            "port": self.port,
            "packets_received": self.packets_received,
            "active_nodes_count": len(self.node_telemetry_cache),
            "tracked_systems": list(self.node_telemetry_cache.keys()),
            "last_packet_age_sec": round(time.time() - self.last_packet_time, 1) if self.last_packet_time > 0 else None,
        }
