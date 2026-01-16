const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { feature: topoFeature } = require("topojson-client");
const { parse: parseCsv } = require("csv-parse/sync");
require("dotenv").config({ path: path.resolve(__dirname, "./config.env") });
const connectDatabase = require("./db");
const State = require("./models/State");

const app = express();
const port = process.env.PORT || 5000;

// Connect DB
connectDatabase();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static: Serve frontend geo/data via backend so Vite can proxy
const FRONTEND_ROOT = path.resolve(__dirname, "../frontend/public");
app.use("/api", express.static(path.join(FRONTEND_ROOT, "api"))); // topojson
app.use("/data", express.static(path.join(FRONTEND_ROOT, "data"))); // data.json

// Health
app.get("/", (req, res) => res.send("EduMap Backend OK"));

// Upload handler
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const { fileType, localPath } = req.body || {};
  try {
    let buffer = null;
    let originalName = null;

    if (req.file) {
      buffer = req.file.buffer;
      originalName = req.file.originalname;
    } else if (localPath) {
      const exists = fs.existsSync(localPath);
      if (!exists) {
        return res.status(400).json({ error: "Local path not found" });
      }
      buffer = fs.readFileSync(localPath);
      originalName = path.basename(localPath);
    } else {
      return res.status(400).json({ error: "No file or localPath provided" });
    }

    const text = buffer.toString("utf-8");

    // Basic processing based on type
    if (fileType === "csv") {
      const rows = parseCsv(text, { columns: true, skip_empty_lines: true });
      // Heuristic upsert into State collection if columns present
      let upserts = 0;
      for (const r of rows) {
        const code = (
          r.code ||
          r.STATE_CODE ||
          r.state_code ||
          r.state ||
          r.STATE ||
          ""
        ).toString();
        const name = (r.name || r.NAME || r.state || "").toString();
        const score = Number(r.score ?? r.inequality_score ?? r.Score ?? 0);
        if (code || name) {
          await State.findOneAndUpdate(
            { $or: [{ code }, { name }] },
            {
              $set: {
                code: code || undefined,
                name: name || undefined,
                score: Number.isFinite(score) ? score : 0,
              },
            },
            { upsert: true }
          );
          upserts++;
        }
      }
      return res.json({ ok: true, kind: "csv", rows: rows.length, upserts });
    }

    if (fileType === "geojson") {
      // Save as asset under backend/uploads
      const uploadsDir = path.resolve(__dirname, "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
      const outPath = path.join(uploadsDir, originalName.replace(/\s+/g, "_"));
      fs.writeFileSync(outPath, buffer);
      return res.json({ ok: true, kind: "geojson", saved: outPath });
    }

    if (fileType === "topojson") {
      // Convert to GeoJSON and save
      const obj = JSON.parse(text);
      const objectKey = Object.keys(obj.objects || {})[0];
      const geoJson = topoFeature(obj, obj.objects[objectKey]);
      const uploadsDir = path.resolve(__dirname, "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
      const outPath = path.join(
        uploadsDir,
        (originalName || "converted").replace(/\.topojson$/i, "") + ".geojson"
      );
      fs.writeFileSync(outPath, JSON.stringify(geoJson));
      return res.json({ ok: true, kind: "topojson", converted: outPath });
    }

    // Default: just save raw
    const uploadsDir = path.resolve(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    const outPath = path.join(uploadsDir, originalName || "upload.bin");
    fs.writeFileSync(outPath, buffer);
    return res.json({ ok: true, kind: "raw", saved: outPath });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload processing failed" });
  }
});

// Aggregated data endpoint from DB or fallback to static
app.get("/api/data", async (req, res) => {
  try {
    const states = await State.find({}).lean();
    if (states.length) {
      const payload = {
        states: states.reduce((acc, s) => {
          acc[(s.code || s.name || "").toString()] = {
            name: s.name,
            score: s.score,
            literacy_pct: s.literacy_pct,
            enrolment_pct: s.enrolment_pct,
            infra_index_pct: s.infra_index_pct,
          };
          return acc;
        }, {}),
        districts: states.reduce((acc, s) => {
          if (s.code && Array.isArray(s.districts)) acc[s.code] = s.districts;
          return acc;
        }, {}),
      };
      return res.json(payload);
    }
    // Fallback to static file used by frontend
    const staticPath = path.join(FRONTEND_ROOT, "data", "data.json");
    if (fs.existsSync(staticPath)) {
      const json = JSON.parse(fs.readFileSync(staticPath, "utf-8"));
      return res.json(json);
    }
    return res.json({ states: {}, districts: {} });
  } catch (err) {
    console.error("/api/data error:", err);
    return res.status(500).json({ error: "Failed to build data payload" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`EduMap backend listening on port ${port}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down backend...");
  process.exit(0);
});
