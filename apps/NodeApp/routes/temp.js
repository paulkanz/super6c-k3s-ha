// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Paul Kanz <kanzpaul@gmail.com>
const telemetryService = require("../telemetryService");

exports.list = function(req, res) {
  const dbHost = process.env.DB_HOST || "unconfigured";
  
  // If req.getConnection is available, attempt database query
  if (typeof req.getConnection === "function") {
    req.getConnection(function(err, connection) {
      if (err || !connection) {
        // Fall back to autonomous simulated mode
        return res.render("temp", {
          page_title: "Canopy & Soil Moisture Telemetry",
          active_tab: "sensors",
          db_connected: false,
          db_host: dbHost,
          stations: telemetryService.getSimulatedStations(),
        });
      }

      // Query database if connected
      const query = `
        SELECT 
          sn.node_id,
          sn.zone_name AS location,
          sn.crop_variety AS variety,
          sn.battery_volts AS volts,
          sn.rssi_dbm AS rssi,
          ct.canopy_temp_f AS canopy_temp,
          ct.canopy_humidity_pct AS canopy_humidity,
          st.depth1_moisture_kpa,
          st.depth1_temp_f,
          st.depth2_moisture_kpa,
          st.depth2_temp_f,
          st.depth3_moisture_kpa,
          st.depth3_temp_f,
          sn.last_seen
        FROM sensor_nodes sn
        LEFT JOIN (
          SELECT t1.* FROM canopy_telemetry t1
          INNER JOIN (SELECT node_id, MAX(recorded_at) as max_time FROM canopy_telemetry GROUP BY node_id) t2
          ON t1.node_id = t2.node_id AND t1.recorded_at = t2.max_time
        ) ct ON sn.node_id = ct.node_id
        LEFT JOIN (
          SELECT s1.* FROM soil_telemetry s1
          INNER JOIN (SELECT node_id, MAX(recorded_at) as max_time FROM soil_telemetry GROUP BY node_id) s2
          ON s1.node_id = s2.node_id AND s1.recorded_at = s2.max_time
        ) st ON sn.node_id = st.node_id
        ORDER BY sn.node_id ASC;
      `;

      connection.query(query, function(sqlErr, rows) {
        if (sqlErr || !rows || rows.length === 0) {
          // If query fails (e.g., tables don't exist yet) or is empty, serve simulated data
          return res.render("temp", {
            page_title: "Canopy & Soil Moisture Telemetry",
            active_tab: "sensors",
            db_connected: false,
            db_host: dbHost,
            stations: telemetryService.getSimulatedStations(),
          });
        }

        // Format MySQL rows to match the view's data model
        const stations = rows.map(r => ({
          node_id: r.node_id,
          location: r.location,
          variety: r.variety || "Grapevine",
          volts: r.volts || 3.9,
          rssi: r.rssi || -75,
          canopy_temp: r.canopy_temp || 72.0,
          canopy_humidity: r.canopy_humidity || 55.0,
          soil: {
            d1_moisture: r.depth1_moisture_kpa || 25.0,
            d1_temp: r.depth1_temp_f || 68.0,
            d2_moisture: r.depth2_moisture_kpa || 32.0,
            d2_temp: r.depth2_temp_f || 64.0,
            d3_moisture: r.depth3_moisture_kpa || 40.0,
            d3_temp: r.depth3_temp_f || 60.0,
          },
          irrigation_status: (r.depth2_moisture_kpa > 45) ? "Irrigate Soon" : "Adequate",
          irrigation_urgency: (r.depth2_moisture_kpa > 45) ? "Irrigate Soon" : "Optimal",
          valve_status: "Active (Drip Line)",
          updated_ago: `Recorded: ${r.last_seen || 'Recent'}`,
        }));

        res.render("temp", {
          page_title: "Canopy & Soil Moisture Telemetry",
          active_tab: "sensors",
          db_connected: true,
          db_host: dbHost,
          stations: stations,
        });
      });
    });
  } else {
    // No connection pool available, render simulated data
    res.render("temp", {
      page_title: "Canopy & Soil Moisture Telemetry",
      active_tab: "sensors",
      db_connected: false,
      db_host: dbHost,
      stations: telemetryService.getSimulatedStations(),
    });
  }
};
