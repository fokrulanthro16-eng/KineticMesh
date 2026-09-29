export interface SwarmNode {
  node_id: string;
  callsign: string;
  role: string;
  icao_hex: string;
  timestamp: number;
  seq: number;
  pos_enu: [number, number, number];
  true_pos_enu: [number, number, number];
  estimated_pos_enu: [number, number, number];
  vel_enu: [number, number, number];
  accel_enu: [number, number, number];
  speed_kmh: number;
  heading: number;
  baro_alt: number;
  lat: number;
  lon: number;
  alt: number;
  reported_lat: number;
  reported_lon: number;
  reported_alt: number;
  estimated_lat: number;
  estimated_lon: number;
  estimated_alt: number;
  is_ghost: boolean;
  is_compromised: boolean;
  is_isolated: boolean;
  trust_score: number;
  spatial_residual_m: number;
  anomaly_flags: string[];
  drift_offset_m?: number;
}

export interface ConsensusBlock {
  block_index: number;
  prev_hash: string;
  block_hash: string;
  timestamp: number;
  cycle: number;
  votes: Record<string, Record<string, boolean>>;
  quarantined_nodes: string[];
  merkle_root: string;
}

export interface AttackStatus {
  ghost_injection: {
    active: boolean;
    ghost_id: string;
    icao: string;
  };
  gps_drift: {
    active: boolean;
    target_node: string;
    offset_meters: number;
    max_drift_meters: number;
  };
  meaconing: {
    active: boolean;
    target_node: string;
    delay_frames: number;
  };
}

export interface SwarmTelemetry {
  cycle: number;
  timestamp: number;
  swarm_center_enu: [number, number, number];
  nodes: Record<string, SwarmNode>;
  ranging_matrix_uwb: Record<string, Record<string, number>>;
  pairwise_residuals: Record<string, Record<string, number>>;
  spatial_residuals?: Record<string, number>;
  quarantined_nodes: string[];
  consensus_block: ConsensusBlock;
  attack_status: AttackStatus;
  emergency_mode?: "PATROL" | "SCATTER" | "RTH";
  telemetry_source?: "MOCK" | "MAVLINK_SITL";
  mavlink_status?: {
    is_running: boolean;
    is_receiving: boolean;
    port: number;
    packets_received: number;
    tracked_systems: string[];
    last_packet_age_sec?: number | null;
  };
  uwb_hardware_status?: {
    driver_name: string;
    port: string;
    baudrate: number;
    is_physical_hardware_connected: boolean;
    mode: string;
    packets_parsed: number;
  };
  consensus_mode?: string;
  global_coordinated_spoof?: boolean;
  resilience_metrics?: {
    knn_k: number;
    knn_edges_active: number;
    knn_pruned_links_count: number;
    topology_efficiency: string;
    link_availability_pct: number;
    rf_blackout_active: boolean;
    nlos_outliers_rejected_total: number;
    recent_nlos_filtered_events: Array<{
      link: string;
      raw_spike_m: number;
      filtered_m: number;
    }>;
  };
}
