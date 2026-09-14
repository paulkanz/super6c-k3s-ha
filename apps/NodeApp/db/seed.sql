-- ==============================================================================
-- Precision Viticulture Sample Seed Data
-- ==============================================================================
USE telemetry_db;

-- Insert Field Stations
INSERT INTO sensor_nodes (node_id, dev_eui, zone_name, crop_variety, latitude, longitude, battery_volts, rssi_dbm)
VALUES 
('SN-001', '0080E1150001A1', 'Block A - Pinot Noir (Upper Bench)', 'Pinot Noir (Clone 667)', 38.412401, -122.451201, 3.92, -74),
('SN-002', '0080E1150001A2', 'Block B - Chardonnay (Mid Slope)', 'Chardonnay (Clone 76)', 38.413105, -122.452890, 3.88, -79),
('SN-003', '0080E1150001A3', 'Block C - Cabernet Sauvignon (Valley Floor)', 'Cabernet Sauvignon (Clone 337)', 38.414520, -122.454120, 3.81, -85)
ON DUPLICATE KEY UPDATE zone_name=VALUES(zone_name);

-- Insert Sample Canopy Telemetry (Temp & Moisture)
INSERT INTO canopy_telemetry (node_id, recorded_at, canopy_temp_f, canopy_humidity_pct, solar_volts, rssi_dbm)
VALUES
('SN-001', NOW(), 74.2, 52.5, 4.90, -74),
('SN-002', NOW(), 72.8, 58.4, 4.75, -79),
('SN-003', NOW(), 76.5, 48.2, 4.60, -85);

-- Insert Sample Soil Telemetry (6 values across 3 depths: moisture tension in kPa + soil temp)
INSERT INTO soil_telemetry (node_id, recorded_at, depth1_moisture_kpa, depth1_temp_f, depth2_moisture_kpa, depth2_temp_f, depth3_moisture_kpa, depth3_temp_f)
VALUES
('SN-001', NOW(), 26.4, 68.2, 33.8, 64.1, 41.2, 60.8),
('SN-002', NOW(), 31.2, 67.0, 38.5, 63.5, 46.0, 59.9),
('SN-003', NOW(), 48.6, 71.2, 44.8, 65.8, 52.4, 61.5);

-- Insert Sample LoRaWAN Uplink Message Logs
INSERT INTO lorawan_messages (node_id, recorded_at, f_port, payload_summary, rssi_dbm, snr_db)
VALUES
('SN-001', DATE_SUB(NOW(), INTERVAL 1 MINUTE), 10, '{"canopy_t":74.2,"canopy_rh":52.5,"soil_kpa":[26.4,33.8,41.2],"soil_t":[68.2,64.1,60.8]}', -74, 9.5),
('SN-002', DATE_SUB(NOW(), INTERVAL 3 MINUTE), 10, '{"canopy_t":72.8,"canopy_rh":58.4,"soil_kpa":[31.2,38.5,46.0],"soil_t":[67.0,63.5,59.9]}', -79, 8.2),
('SN-003', DATE_SUB(NOW(), INTERVAL 5 MINUTE), 10, '{"canopy_t":76.5,"canopy_rh":48.2,"soil_kpa":[48.6,44.8,52.4],"soil_t":[71.2,65.8,61.5]}', -85, 6.8);
