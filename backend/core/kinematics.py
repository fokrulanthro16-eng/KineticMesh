"""
KineticMesh - Kinematics & Coordinate Transformation Subsystem
WGS-84 Ellipsoid <-> Local ENU (East-North-Up) Projection & Kinematic State Vectors
"""

import math
import time
from typing import Tuple, List, Optional
from pydantic import BaseModel, Field

# WGS-84 Ellipsoid Constants
WGS84_A = 6378137.0          # Semi-major axis in meters
WGS84_F = 1.0 / 298.257223563 # Flattening factor
WGS84_E2 = 2 * WGS84_F - WGS84_F ** 2 # First eccentricity squared

# Default Tactical Airspace Coordinate Reference Origin (Mojave Test Range / Edwards Corridor)
DEFAULT_ORIGIN_LAT = 34.9055
DEFAULT_ORIGIN_LON = -117.8837
DEFAULT_ORIGIN_ALT = 700.0


def geodetic_to_ecef(lat: float, lon: float, alt: float) -> Tuple[float, float, float]:
    """Convert geodetic (lat, lon, alt) to Earth-Centered, Earth-Fixed (ECEF) Cartesian coordinates."""
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    
    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    sin_lon = math.sin(lon_rad)
    cos_lon = math.cos(lon_rad)
    
    # Prime vertical radius of curvature
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * (sin_lat ** 2))
    
    x = (n + alt) * cos_lat * cos_lon
    y = (n + alt) * cos_lat * sin_lon
    z = (n * (1.0 - WGS84_E2) + alt) * sin_lat
    return x, y, z


def ecef_to_enu(x: float, y: float, z: float,
                ref_lat: float, ref_lon: float, ref_alt: float) -> Tuple[float, float, float]:
    """Convert ECEF coordinates to local East-North-Up (ENU) coordinates relative to a reference origin."""
    ref_x, ref_y, ref_z = geodetic_to_ecef(ref_lat, ref_lon, ref_alt)
    
    dx = x - ref_x
    dy = y - ref_y
    dz = z - ref_z
    
    lat_rad = math.radians(ref_lat)
    lon_rad = math.radians(ref_lon)
    
    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    sin_lon = math.sin(lon_rad)
    cos_lon = math.cos(lon_rad)
    
    # Rotation matrix to local ENU
    east = -sin_lon * dx + cos_lon * dy
    north = -sin_lat * cos_lon * dx - sin_lat * sin_lon * dy + cos_lat * dz
    up = cos_lat * cos_lon * dx + cos_lat * sin_lon * dy + sin_lat * dz
    
    return east, north, up


def geodetic_to_enu(lat: float, lon: float, alt: float,
                    ref_lat: float = DEFAULT_ORIGIN_LAT,
                    ref_lon: float = DEFAULT_ORIGIN_LON,
                    ref_alt: float = DEFAULT_ORIGIN_ALT) -> Tuple[float, float, float]:
    """Direct conversion from Geodetic to ENU (East-North-Up in meters)."""
    x, y, z = geodetic_to_ecef(lat, lon, alt)
    return ecef_to_enu(x, y, z, ref_lat, ref_lon, ref_alt)


def enu_to_geodetic(east: float, north: float, up: float,
                     ref_lat: float = DEFAULT_ORIGIN_LAT,
                     ref_lon: float = DEFAULT_ORIGIN_LON,
                     ref_alt: float = DEFAULT_ORIGIN_ALT) -> Tuple[float, float, float]:
    """Convert local ENU coordinates back to WGS-84 Geodetic (Lat, Lon, Alt)."""
    # Flat-earth approximation accurate to < 0.05m within 30km of origin
    lat_rad = math.radians(ref_lat)
    
    # Radii of curvature
    m = WGS84_A * (1.0 - WGS84_E2) / ((1.0 - WGS84_E2 * (math.sin(lat_rad) ** 2)) ** 1.5)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * (math.sin(lat_rad) ** 2))
    
    d_lat = north / (m + ref_alt)
    d_lon = east / ((n + ref_alt) * math.cos(lat_rad))
    
    lat = ref_lat + math.degrees(d_lat)
    lon = ref_lon + math.degrees(d_lon)
    alt = ref_alt + up
    return lat, lon, alt


class KinematicState(BaseModel):
    """Complete Kinematic Telemetry and State Representation for a Drone Node."""
    node_id: str
    callsign: str
    timestamp: float = Field(default_factory=time.time)
    seq: int = 0
    lat: float
    lon: float
    alt: float
    pos_enu: List[float]       # [East, North, Up] in meters
    vel_enu: List[float]       # [Vx, Vy, Vz] in m/s
    accel_enu: List[float]     # [Ax, Ay, Az] in m/s²
    speed_kmh: float           # Scalar speed in km/h
    heading: float             # Degrees [0, 360)
    baro_alt: float            # Barometric altitude (m)
    
    # Ground Truth & Consensus Metadata
    true_pos_enu: List[float]  # Actual physical position (unaffected by GPS spoofing)
    estimated_pos_enu: List[float] # Consensus-derived position
    is_compromised: bool = False
    is_isolated: bool = False
    anomaly_flags: List[str] = Field(default_factory=list)
    trust_score: float = 100.0 # 0.0 to 100.0%
    is_ghost: bool = False
    icao_hex: str = ""
