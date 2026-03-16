// Import dependencies
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: "*", // Allow ESP8266
  methods: ["GET", "POST", "PUT"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "10kb" }));
app.use(express.static("public"));

// ====== Data persistence file ======
const STATE_FILE = "relayState.json";

// ====== Load/Save state ======
async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.log("📁 No saved state, using defaults");
    return { r1: 0, r2: 0, r3: 0, r4: 0 };
  }
}

async function saveState(state) {
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("💾 Save failed:", error.message);
  }
}

// ====== Global relay state ======
let relayState = { r1: 0, r2: 0, r3: 0, r4: 0 };

// Load state on startup
async function initState() {
  relayState = await loadState();
  console.log("📊 Initial state:", relayState);
}
initState();

// ====== VALIDATION ======
const validChannels = ["r1", "r2", "r3", "r4"];

function validateState(state) {
  const valid = { ...relayState }; // Start with current
  
  if (typeof state === "object") {
    for (const [key, value] of Object.entries(state)) {
      if (validChannels.includes(key) && (value === 0 || value === 1 || value === true || value === false)) {
        valid[key] = value ? 1 : 0;
      }
    }
  }
  
  return valid;
}

// ====== API Endpoints ======

// 1. GET /api/state - ESP Polling (MATCHES ESP CODE)
app.get("/api/state", (req, res) => {
  console.log("📡 GET /api/state →", relayState);
  res.json(relayState);
});

// 2. POST /api/state - ESP Full State Update (MATCHES ESP POST!)
app.post("/api/state", async (req, res) => {
  console.log("📤 POST /api/state ←", req.body);
  
  const newState = validateState(req.body);
  
  // Only save if changed
  if (JSON.stringify(newState) !== JSON.stringify(relayState)) {
    relayState = newState;
    await saveState(relayState);
    console.log("✅ State updated:", relayState);
  }
  
  res.json({ 
    success: true, 
    state: relayState 
  });
});

// 3. POST /api/set - Single relay (Web/App control)
app.post("/api/set", async (req, res) => {
  const { ch, state } = req.body;
  
  if (!ch || !["1", "2", "3", "4"].includes(ch)) {
    return res.status(400).json({ error: "Invalid channel (1-4)" });
  }
  
  const key = `r${ch}`;
  const newState = state ? 1 : 0;
  
  if (relayState[key] !== newState) {
    relayState[key] = newState;
    await saveState(relayState);
    console.log(`🔧 R${ch} ← ${newState}`);
  }
  
  res.json({ 
    success: true, 
    state: relayState 
  });
});

// 4. GET /api/toggle/:ch - Quick toggle
app.get("/api/toggle/:ch", async (req, res) => {
  const ch = req.params.ch;
  
  if (!["1", "2", "3", "4"].includes(ch)) {
    return res.status(400).json({ error: "Invalid channel (1-4)" });
  }
  
  const key = `r${ch}`;
  relayState[key] = relayState[key] ? 0 : 1;
  await saveState(relayState);
  
  console.log(`🔄 Toggle R${ch} → ${relayState[key]}`);
  res.json(relayState);
});

// ====== Web Dashboard ======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ====== Health check ======
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    relays: relayState,
    timestamp: new Date().toISOString()
  });
});

// ====== 404 Handler ======
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ====== Error Handler ======
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 GET:  /api/state`);
  console.log(`📤 POST: /api/state`);
  console.log(`🔧 POST: /api/set {ch:1, state:true}`);
  console.log(`🌐 Web:  http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Saving state & shutting down...");
  await saveState(relayState);
  process.exit(0);
});
