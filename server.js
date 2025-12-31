// Import dependencies
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve static HTML/CSS/JS

// ====== Relay state ======
let relayState = {
  r1: 0,
  r2: 0,
  r3: 0,
  r4: 0
};

// ====== API Endpoints ======

// Get relay state
app.get("/api/state", (req, res) => {
  res.json(relayState);
});

// Set relay state
app.post("/api/set", (req, res) => {
  const { ch, state } = req.body;
  const key = `r${ch}`;

  if (!relayState.hasOwnProperty(key)) {
    return res.status(400).json({ error: "Invalid channel" });
  }

  relayState[key] = state ? 1 : 0;
  res.json({ success: true, relayState });
});

// Toggle relay
app.get("/api/toggle/:ch", (req, res) => {
  const key = `r${req.params.ch}`;
  if (!relayState.hasOwnProperty(key)) {
    return res.status(400).json({ error: "Invalid channel" });
  }
  relayState[key] = relayState[key] ? 0 : 1;
  res.json(relayState);
});

// ====== Serve main page ======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ====== Start server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
