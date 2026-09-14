// ==============================================================================
// Precision Viticulture Telemetry Service
// Supports autonomous simulation (zero-config demo mode) and MySQL persistence
// ==============================================================================

/**
 * Returns simulated precision viticulture telemetry.
 * Generates realistic values with slight micro-variations on each request.
 */
function getSimulatedStations() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();

  // Helper for small random jitter
  const jitter = (base, delta = 0.5) => {
    const val = base + (Math.random() * (delta * 2) - delta);
    return Math.round(val * 10) / 10;
  };

  return [
    {
      node_id: "SN-001",
      dev_eui: "0080E1150001A1",
      location: "Block A - Pinot Noir (Upper Bench)",
      variety: "Pinot Noir (Clone 667)",
      volts: jitter(3.92, 0.02),
      rssi: Math.round(jitter(-74, 2)),
      // Canopy Microclimate (2 values: temperature and moisture)
      canopy_temp: jitter(74.2, 0.8),
      canopy_humidity: jitter(52.5, 1.2),
      // Soil Profile: 6 values across 3 depths (moisture tension in kPa + soil temp)
      soil: {
        d1_moisture: jitter(26.4, 0.6), // 6" Shallow (kPa / centibars)
        d1_temp: jitter(68.2, 0.4),     // 6" Shallow (°F)
        d2_moisture: jitter(33.8, 0.5), // 18" Root Zone (kPa)
        d2_temp: jitter(64.1, 0.3),     // 18" Root Zone (°F)
        d3_moisture: jitter(41.2, 0.4), // 36" Deep Subsoil (kPa)
        d3_temp: jitter(60.8, 0.2),     // 36" Deep Subsoil (°F)
      },
      irrigation_status: "Adequate (No Stress)",
      irrigation_urgency: "Optimal",
      valve_status: "Closed (Idle)",
      updated_ago: `Updated at ${timeStr}`,
    },
    {
      node_id: "SN-002",
      dev_eui: "0080E1150001A2",
      location: "Block B - Chardonnay (Mid Slope)",
      variety: "Chardonnay (Clone 76)",
      volts: jitter(3.88, 0.02),
      rssi: Math.round(jitter(-79, 2)),
      // Canopy Microclimate (2 values: temperature and moisture)
      canopy_temp: jitter(72.8, 0.7),
      canopy_humidity: jitter(58.4, 1.5),
      // Soil Profile: 6 values across 3 depths
      soil: {
        d1_moisture: jitter(31.2, 0.8),
        d1_temp: jitter(67.0, 0.4),
        d2_moisture: jitter(38.5, 0.6),
        d2_temp: jitter(63.5, 0.3),
        d3_moisture: jitter(46.0, 0.4),
        d3_temp: jitter(59.9, 0.2),
      },
      irrigation_status: "Field Capacity Target",
      irrigation_urgency: "Optimal",
      valve_status: "Closed (Idle)",
      updated_ago: `Updated at ${timeStr}`,
    },
    {
      node_id: "SN-003",
      dev_eui: "0080E1150001A3",
      location: "Block C - Cabernet Sauvignon (Valley Floor)",
      variety: "Cabernet Sauvignon (Clone 337)",
      volts: jitter(3.81, 0.02),
      rssi: Math.round(jitter(-85, 2)),
      // Canopy Microclimate (2 values: temperature and moisture)
      canopy_temp: jitter(76.5, 0.9),
      canopy_humidity: jitter(48.2, 1.4),
      // Soil Profile: 6 values across 3 depths
      soil: {
        d1_moisture: jitter(48.6, 1.2), // Drying faster in warm valley soil
        d1_temp: jitter(71.2, 0.5),
        d2_moisture: jitter(44.8, 0.7),
        d2_temp: jitter(65.8, 0.3),
        d3_moisture: jitter(52.4, 0.5),
        d3_temp: jitter(61.5, 0.2),
      },
      irrigation_status: "Drip Pulse Scheduled",
      irrigation_urgency: "Irrigate Soon",
      valve_status: "Queued (04:00 AM, 90 min)",
      updated_ago: `Updated at ${timeStr}`,
    },
  ];
}

/**
 * Returns simulated LoRaWAN uplink packets.
 */
function getSimulatedMessages() {
  const now = Date.now();
  const minutesAgo = (min) => new Date(now - min * 60 * 1000).toISOString().replace("T", " ").substr(0, 19);

  return [
    {
      ts: minutesAgo(1),
      dev_eui: "0080E1150001A1",
      location: "Block A - Pinot Noir (Upper Bench)",
      fport: 10,
      payload_summary: '{"canopy_t":74.2,"canopy_rh":52.5,"soil_kpa":[26.4,33.8,41.2],"soil_t":[68.2,64.1,60.8]}',
      rssi: -74,
      snr: 9.5,
    },
    {
      ts: minutesAgo(3),
      dev_eui: "0080E1150001A2",
      location: "Block B - Chardonnay (Mid Slope)",
      fport: 10,
      payload_summary: '{"canopy_t":72.8,"canopy_rh":58.4,"soil_kpa":[31.2,38.5,46.0],"soil_t":[67.0,63.5,59.9]}',
      rssi: -79,
      snr: 8.2,
    },
    {
      ts: minutesAgo(5),
      dev_eui: "0080E1150001A3",
      location: "Block C - Cabernet Sauvignon (Valley Floor)",
      fport: 10,
      payload_summary: '{"canopy_t":76.5,"canopy_rh":48.2,"soil_kpa":[48.6,44.8,52.4],"soil_t":[71.2,65.8,61.5]}',
      rssi: -85,
      snr: 6.8,
    },
    {
      ts: minutesAgo(11),
      dev_eui: "0080E1150001A1",
      location: "Block A - Pinot Noir (Upper Bench)",
      fport: 1,
      payload_summary: '{"battery_v":3.92,"solar_v":4.88,"charging":true,"reboots":0}',
      rssi: -73,
      snr: 9.8,
    },
    {
      ts: minutesAgo(14),
      dev_eui: "0080E1150001A2",
      location: "Block B - Chardonnay (Mid Slope)",
      fport: 1,
      payload_summary: '{"battery_v":3.88,"solar_v":4.75,"charging":true,"reboots":0}',
      rssi: -80,
      snr: 8.0,
    },
    {
      ts: minutesAgo(17),
      dev_eui: "0080E1150001A3",
      location: "Block C - Cabernet Sauvignon (Valley Floor)",
      fport: 1,
      payload_summary: '{"battery_v":3.81,"solar_v":4.62,"charging":true,"reboots":0}',
      rssi: -84,
      snr: 7.1,
    },
  ];
}

module.exports = {
  getSimulatedStations,
  getSimulatedMessages,
};
