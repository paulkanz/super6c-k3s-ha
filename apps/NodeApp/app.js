// ==============================================================================
// Precision Viticulture IIoT Edge Telemetry Gateway
// Reference Architecture for DeskPi Super6C K3s Cluster
// ==============================================================================
const express = require("express");
const http = require("http");
const path = require("path");
const logger = require("morgan");
const methodOverride = require("method-override");
const session = require("express-session");
const multer = require("multer");
const errorHandler = require("errorhandler");
const crypto = require("crypto");

// Routes
const messages = require("./routes/messages");
const temp = require("./routes/temp");

const app = express();

// Security Hardening: suppress application framework banner
app.disable("x-powered-by");

// Environment & Configuration
const PORT = process.env.PORT || 4300;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const DEMO_MODE = process.env.DEMO_MODE === "true" || !DB_HOST;

if (DEMO_MODE) {
  console.log("🍇 [INFO] Running in Autonomous Simulation Mode (Zero-Config Demo).");
  console.log("   Serving live synthetic precision viticulture sensor telemetry.");
  console.log("   To persist telemetry, attach a MySQL/MariaDB database via DB_HOST.");
} else {
  console.log(`🔌 [INFO] Configured for MySQL Database at ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
}

// Middleware
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

// Session configuration
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(multer().none());

// Optional MySQL Connection Pool (only if configured and not explicitly demo mode)
if (!DEMO_MODE && DB_HOST && DB_USER) {
  const connection = require("express-myconnection");
  const mysql = require("mysql");

  app.use(
    connection(
      mysql,
      {
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        port: DB_PORT,
        database: DB_NAME,
        timezone: "local",
        dateStrings: true,
        connectTimeout: 3000,
      },
      "pool"
    )
  );
}

// Development error handler
if (app.get("env") === "development") {
  app.use(errorHandler());
}

// View engine configuration
app.set("port", PORT);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ==============================================================================
// Kubernetes Probes & Liveness / Readiness Endpoints
// ==============================================================================
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: "edge-iiot-sensor-portal",
    mode: DEMO_MODE ? "simulated" : "database",
  });
});

app.get("/readyz", (req, res) => {
  res.status(200).json({
    status: "ready",
    mode: DEMO_MODE ? "simulated" : "database",
  });
});

// ==============================================================================
// Application Ingress Routes
// ==============================================================================
// Primary environmental & 3-depth soil telemetry routes
app.get("/nodeapp/temp", temp.list);
app.get("/nodeapp/sensors", temp.list);

// LoRaWAN uplink frame ingestion log
app.get("/nodeapp/messages", messages.list);

// Root and catch-all redirects
app.get("/nodeapp", (req, res) => res.redirect("/nodeapp/temp"));
app.get("/nodeapp/*", temp.list);
app.get("/", (req, res) => res.redirect("/nodeapp/temp"));

// Start HTTP Server
http.createServer(app).listen(app.get("port"), () => {
  console.log(`🚀 Edge Sensor Portal listening on port ${app.get("port")}`);
});
