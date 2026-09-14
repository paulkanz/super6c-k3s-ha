-- ==============================================================================
-- Precision Viticulture IIoT Database Schema
-- Optimized for MariaDB / MySQL / Percona on Edge Infrastructure
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS telemetry_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE telemetry_db;

-- 1. Sensor Nodes (Registered Field Stations)
CREATE TABLE IF NOT EXISTS sensor_nodes (
    node_id VARCHAR(32) PRIMARY KEY,
    dev_eui VARCHAR(64) UNIQUE,
    zone_name VARCHAR(128) NOT NULL,
    crop_variety VARCHAR(64) DEFAULT 'Grapevine',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    battery_volts DECIMAL(4, 2) DEFAULT 3.90,
    rssi_dbm INT DEFAULT -75,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Soil Moisture & Temperature Profile (3 Depths: 6 Values)
-- Soil moisture tension recorded in kPa / centibars (0-10: Saturated, 10-30: Field Capacity, 30-60: Normal, >60: Stress)
CREATE TABLE IF NOT EXISTS soil_telemetry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(32) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Depth 1: Shallow (6 in / 15 cm)
    depth1_moisture_kpa DECIMAL(5, 1) NOT NULL,
    depth1_temp_f DECIMAL(5, 1) NOT NULL,
    -- Depth 2: Root Zone (18 in / 45 cm)
    depth2_moisture_kpa DECIMAL(5, 1) NOT NULL,
    depth2_temp_f DECIMAL(5, 1) NOT NULL,
    -- Depth 3: Deep Subsoil (36 in / 90 cm)
    depth3_moisture_kpa DECIMAL(5, 1) NOT NULL,
    depth3_temp_f DECIMAL(5, 1) NOT NULL,
    INDEX idx_soil_node_time (node_id, recorded_at DESC),
    CONSTRAINT fk_soil_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(node_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Canopy Microclimate Telemetry (Ambient Temperature & Humidity/Moisture)
CREATE TABLE IF NOT EXISTS canopy_telemetry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(32) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    canopy_temp_f DECIMAL(5, 1) NOT NULL,
    canopy_humidity_pct DECIMAL(5, 1) NOT NULL,
    solar_volts DECIMAL(4, 2) DEFAULT 4.80,
    rssi_dbm INT DEFAULT -75,
    INDEX idx_canopy_node_time (node_id, recorded_at DESC),
    CONSTRAINT fk_canopy_node FOREIGN KEY (node_id) REFERENCES sensor_nodes(node_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. LoRaWAN Raw Packet Frames (Uplink Ingestion Log)
CREATE TABLE IF NOT EXISTS lorawan_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(32) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    f_port INT DEFAULT 10,
    payload_summary TEXT NOT NULL,
    rssi_dbm INT DEFAULT -75,
    snr_db DECIMAL(4, 1) DEFAULT 8.0,
    gateway_id VARCHAR(64) DEFAULT 'super6c-edge-gw-01',
    INDEX idx_lora_time (recorded_at DESC)
) ENGINE=InnoDB;
