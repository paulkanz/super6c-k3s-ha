const telemetryService = require("../telemetryService");

exports.list = function(req, res) {
  const dbHost = process.env.DB_HOST || "unconfigured";

  if (typeof req.getConnection === "function") {
    req.getConnection(function(err, connection) {
      if (err || !connection) {
        return res.render("messages", {
          page_title: "LoRaWAN Uplink Packet Logs",
          active_tab: "messages",
          db_connected: false,
          db_host: dbHost,
          messages: telemetryService.getSimulatedMessages(),
        });
      }

      const query = `
        SELECT 
          lm.recorded_at AS ts,
          lm.node_id AS dev_eui,
          COALESCE(sn.zone_name, 'Field Node') AS location,
          lm.f_port AS fport,
          lm.payload_summary,
          lm.rssi_dbm AS rssi,
          lm.snr_db AS snr
        FROM lorawan_messages lm
        LEFT JOIN sensor_nodes sn ON lm.node_id = sn.node_id
        ORDER BY lm.recorded_at DESC
        LIMIT 10;
      `;

      connection.query(query, function(sqlErr, rows) {
        if (sqlErr || !rows || rows.length === 0) {
          return res.render("messages", {
            page_title: "LoRaWAN Uplink Packet Logs",
            active_tab: "messages",
            db_connected: false,
            db_host: dbHost,
            messages: telemetryService.getSimulatedMessages(),
          });
        }

        res.render("messages", {
          page_title: "LoRaWAN Uplink Packet Logs",
          active_tab: "messages",
          db_connected: true,
          db_host: dbHost,
          messages: rows,
        });
      });
    });
  } else {
    res.render("messages", {
      page_title: "LoRaWAN Uplink Packet Logs",
      active_tab: "messages",
      db_connected: false,
      db_host: dbHost,
      messages: telemetryService.getSimulatedMessages(),
    });
  }
};
