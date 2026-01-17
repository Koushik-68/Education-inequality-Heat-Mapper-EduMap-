// src/pages/StateSummary.jsx
import React, { useEffect, useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import axios from "axios";
import { feature as topoFeature } from "topojson-client";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* =======================
   CONFIG
======================= */
const GEOJSON_URL = "/api/karnataka-districts.topojson";
const DATA_URL = "/data/data.json";
const STATE_CODE = "KA";

/* =======================
   NAME NORMALIZATION (ML ↔︎ GEO)
   Maps common old → canonical district names used by ML JSON
======================= */
const NAME_MAP = {
  Bangalore: "Bengaluru Urban",
  "Bangalore Urban": "Bengaluru Urban",
  "Bangalore Rural": "Bengaluru Rural",
  Mysore: "Mysuru",
  Bellary: "Ballari",
  Bijapur: "Vijayapura",
  Gulbarga: "Kalaburagi",
  Shimoga: "Shivamogga",
  Chikmagalur: "Chikkamagaluru",
  "South Kanara": "Dakshina Kannada",
  "North Kanara": "Uttara Kannada",
  Belgaum: "Belagavi",
  Dharwar: "Dharwad",
  Davangere: "Davanagere",
  Tumkur: "Tumakuru",
  Chikballapur: "Chikkaballapur",
  Ramanagaram: "Ramanagara",
};

function canonicalName(name) {
  if (!name) return "";
  const trimmed = String(name).trim();
  return NAME_MAP[trimmed] || trimmed;
}

function getColor(val) {
  if (val >= 0.75) return "#006400"; // Excellent (Dark Green)
  if (val >= 0.5) return "#FFD700"; // Moderate (Yellow)
  if (val >= 0.25) return "#FF8C00"; // Poor (Orange)
  return "#8B0000"; // Critical (Red)
}

function getLabel(val) {
  if (val >= 0.75) return "Excellent";
  if (val >= 0.5) return "Moderate";
  if (val >= 0.25) return "Poor";
  return "Critical";
}

/* =======================
   DESIGN SYSTEM
======================= */
const COLORS = {
  primary: "#0B3D91",
  bg: "#F6F8FB",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
};

/* =======================
   LEAFLET FIX
======================= */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/* =======================
   FIT BOUNDS
======================= */
/* =======================
   EXTRACT DISTRICT NAMES
======================= */
function extractDistrictNames(geo) {
  if (!geo?.features) return [];
  return geo.features.map((f, idx) => ({
    id: idx,
    name:
      f.properties?.district || f.properties?.DISTRICT || f.properties?.name,
  }));
}

function FitToBounds({ geo }) {
  const map = useMap();
  useEffect(() => {
    if (!geo) return;
    const layer = L.geoJSON(geo);
    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  }, [geo, map]);
  return null;
}

/* =======================
   MAIN COMPONENT
======================= */
export default function StateSummary() {
  const [geo, setGeo] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [districtPred, setDistrictPred] = useState({});
  const [baselinePred, setBaselinePred] = useState({});
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [mlInput, setMlInput] = useState({
    population_lakhs: 10.0,
    literacy_rate: 75.0,
    pupil_teacher_ratio: 28.0,
    teacher_difference: 12.0,
  });
  const [expl, setExpl] = useState(null);
  const [explLoading, setExplLoading] = useState(false);
  const [explError, setExplError] = useState("");
  const [loading, setLoading] = useState(true);
  const reportRef = useRef(null);
  const [showReport, setShowReport] = useState(false);

  /* Load data */
  useEffect(() => {
    const load = async () => {
      const [gRes, dRes, mlRes] = await Promise.all([
        axios.get(GEOJSON_URL),
        axios.get(DATA_URL),
        axios.post("/api/ml/predict-district-wise"),
      ]);

      let geoJson = gRes.data;
      if (geoJson.objects) {
        geoJson = topoFeature(
          geoJson,
          geoJson.objects[Object.keys(geoJson.objects)[0]],
        );
      }

      setGeo(geoJson);

      // ✅ FIXED LINE
      const list = extractDistrictNames(geoJson);
      setDistricts(list);

      const predsRaw = mlRes.data?.district_predictions || {};
      // Re-key predictions by canonical ML names for consistent lookups
      const preds = Object.keys(predsRaw).reduce((acc, k) => {
        acc[canonicalName(k)] = predsRaw[k];
        return acc;
      }, {});
      setDistrictPred(preds);
      setBaselinePred(preds);

      const firstName =
        (list[0] && list[0].name) || Object.keys(preds)[0] || "";
      setSelectedDistrict(firstName);

      setLoading(false);
    };

    load();
  }, []);

  const defaultInput = {
    population_lakhs: 10.0,
    literacy_rate: 75.0,
    pupil_teacher_ratio: 28.0,
    teacher_difference: 12.0,
  };

  const runPrediction = async () => {
    try {
      const res = await axios.post("/api/ml/predict-district", mlInput);
      const eii = res.data?.inequality_index ?? res.data?.EII ?? 0;
      const key = canonicalName(selectedDistrict);
      console.info("Predict →", { district: key, payload: mlInput, eii });
      setDistrictPred((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          inequality_index: eii,
          lastUpdatedAt: new Date().toISOString(),
        },
      }));
    } catch (e) {
      console.error("Prediction failed", e);
    }
  };

  const resetAll = () => {
    setDistrictPred(baselinePred);
    setMlInput(defaultInput);
    setExpl(null);
    setExplError("");
  };

  const downloadPDF = async () => {
    try {
      setShowReport(true);
      // Wait a tick for the report DOM to render
      await new Promise((r) => setTimeout(r, 60));

      if (!reportRef.current) return;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const ratio = imgHeightPx / imgWidthPx;
      const imgHeightMm = pageWidth * ratio;

      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeightMm);

      // Watermark
      pdf.setTextColor(200, 200, 200);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(60);
      pdf.text("EduMap", pageWidth / 2, pageHeight / 2, {
        angle: 45,
        align: "center",
      });

      const key = canonicalName(selectedDistrict);
      const fileName = `EduMap_Report_${key || "District"}.pdf`;
      pdf.save(fileName);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setShowReport(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", padding: 24 }}>
      {/* GRID WRAPPER */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "2.2fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* MAP CARD */}
        <div
          style={{
            background: COLORS.card,
            borderRadius: 12,
            padding: 16,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <h2 style={{ color: COLORS.primary, marginBottom: 6 }}>
            Karnataka – District Educational Inequality
          </h2>
          <p style={{ color: COLORS.muted, marginBottom: 12 }}>
            ML-based Educational Inequality Index (EII)
          </p>

          {/* LEGEND */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            {[
              ["Excellent", "#006400"],
              ["Moderate", "#FFD700"],
              ["Poor", "#FF8C00"],
              ["Critical", "#8B0000"],
            ].map(([label, color]) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center" }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    background: color,
                    marginRight: 6,
                  }}
                />
                <span style={{ fontSize: 13, color: COLORS.text }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ height: 460, borderRadius: 8, overflow: "hidden" }}>
            <MapContainer
              center={[15.3173, 75.7139]}
              zoom={7}
              style={{ height: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {geo && (
                <>
                  <GeoJSON
                    key={selectedDistrict}
                    data={geo}
                    style={(feature) => {
                      const name =
                        feature.properties?.district ||
                        feature.properties?.DISTRICT ||
                        feature.properties?.name;
                      const key = canonicalName(name);
                      const isSelected =
                        canonicalName(selectedDistrict) === key;
                      const eii =
                        districtPred[key]?.inequality_index ??
                        districtPred[key]?.EII ??
                        0;
                      return {
                        fillColor: getColor(eii),
                        color: isSelected ? "#2563eb" : "#333",
                        weight: isSelected ? 5 : 1,
                        fillOpacity: isSelected ? 0.9 : 0.85,
                        className: isSelected ? "selected-district" : undefined,
                      };
                    }}
                    onEachFeature={(feature, layer) => {
                      const name =
                        feature.properties?.district ||
                        feature.properties?.DISTRICT ||
                        feature.properties?.name;
                      const key = canonicalName(name);
                      const pred = districtPred[key] || {};
                      const eii = pred?.inequality_index ?? pred?.EII ?? 0;
                      const f = pred?.features || {};
                      const pop = f.population_lakhs;
                      const lit = f.literacy_rate;
                      const ptr = f.pupil_teacher_ratio;
                      const td = f.teacher_difference;
                      const lastUpdated = pred?.lastUpdatedAt;
                      const ts = lastUpdated
                        ? new Date(lastUpdated).toLocaleString()
                        : null;
                      const updatedBadge = lastUpdated
                        ? `<span style="display:inline-block;padding:2px 6px;border-radius:6px;background:#2563eb;color:#fff;font-size:11px;margin-right:6px;">Updated</span>`
                        : "";
                      const updatedInfo = lastUpdated
                        ? `<small style="color:#6B7280">${ts}</small>`
                        : "";
                      const details =
                        pop !== undefined || lit !== undefined
                          ? `<br/>
                          <small>
                          Pop: ${pop ?? "-"} L | Lit: ${lit ?? "-"}%<br/>
                          PTR: ${ptr ?? "-"} | Teacher gap: ${td ?? "-"}
                          </small>`
                          : "";
                      layer.bindPopup(
                        `<strong>${name}</strong><br/>
                         Inequality Index: ${eii}<br/>
                         ${updatedBadge}Status: ${getLabel(eii)} ${updatedInfo}${details}`,
                      );

                      // Click to select and emphasize the district
                      layer.on("click", () => {
                        setSelectedDistrict(name);
                        try {
                          layer.bringToFront();
                        } catch (e) {}
                      });

                      // Ensure currently selected district sits above others
                      if (canonicalName(selectedDistrict) === key) {
                        try {
                          layer.bringToFront();
                        } catch (e) {}
                      }
                    }}
                  />
                  <FitToBounds geo={geo} />
                </>
              )}

              {/* {districts.map((d) => (
                <Marker key={d.id} position={[d.lat, d.lng]}>
                  <Popup>
                    <strong>{d.name}</strong>
                    <br />
                    Recorded Score: {d.score}
                  </Popup>
                </Marker>
              ))} */}
            </MapContainer>
          </div>
        </div>

        {/* CONTROLS PANEL (RIGHT SIDE) */}
        <div
          style={{
            background: COLORS.card,
            borderRadius: 12,
            padding: 16,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <h3 style={{ color: COLORS.primary, marginBottom: 8 }}>
            What-if Simulation (Selected District)
          </h3>

          {/* Baseline vs Simulated panel with % change and status transition */}
          {(() => {
            const key = canonicalName(selectedDistrict);
            const baseEII =
              baselinePred[key]?.inequality_index ?? baselinePred[key]?.EII;
            const currEII =
              districtPred[key]?.inequality_index ?? districtPred[key]?.EII;
            const baseLabel =
              typeof baseEII === "number" ? getLabel(baseEII) : "—";
            const currLabel =
              typeof currEII === "number" ? getLabel(currEII) : "—";

            const hasNumbers =
              typeof baseEII === "number" && typeof currEII === "number";
            const deltaVal = hasNumbers ? currEII - baseEII : 0;
            const pctVal =
              hasNumbers && baseEII !== 0 ? (deltaVal / baseEII) * 100 : null;
            const worsened = hasNumbers && deltaVal > 0; // higher EII = more inequality
            const improved = hasNumbers && deltaVal < 0;
            const changedLabel = hasNumbers ? baseLabel !== currLabel : false;

            const chipColor = worsened
              ? "#ef4444"
              : improved
                ? "#2563eb"
                : "#6B7280";
            const chipText = worsened
              ? "Inequality increased"
              : improved
                ? "Inequality reduced"
                : "No change";

            return (
              <div
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, color: COLORS.text }}>
                    Baseline vs Simulated
                  </div>
                  {hasNumbers && (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: chipColor,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {chipText}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      Baseline EII
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: COLORS.text,
                        fontSize: 18,
                      }}
                    >
                      {typeof baseEII === "number" ? baseEII.toFixed(3) : "—"}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {baseLabel}
                    </div>
                  </div>
                  <div
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      Simulated EII
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: COLORS.text,
                        fontSize: 18,
                      }}
                    >
                      {typeof currEII === "number" ? currEII.toFixed(3) : "—"}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {currLabel}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      Change
                    </div>
                    <div style={{ fontWeight: 700, color: COLORS.text }}>
                      {hasNumbers
                        ? `${deltaVal.toFixed(3)} (${pctVal !== null ? pctVal.toFixed(1) + "%" : "—"})`
                        : "—"}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {hasNumbers
                        ? worsened
                          ? "Higher inequality"
                          : improved
                            ? "Lower inequality"
                            : "No change"
                        : "—"}
                    </div>
                  </div>
                  <div
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      Status
                    </div>
                    <div style={{ fontWeight: 700, color: COLORS.text }}>
                      {changedLabel ? `${baseLabel} → ${currLabel}` : baseLabel}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {changedLabel ? "Color bin changed" : "Bin unchanged"}
                    </div>
                  </div>
                </div>

                <div
                  style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}
                >
                  Tip: Lower EII indicates lower inequality. Adjust sliders,
                  then press "Predict & Update Map".
                </div>
              </div>
            );
          })()}

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            {/* District selector */}
            <div style={{ gridColumn: "1 / span 2" }}>
              <label
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  marginBottom: 6,
                  display: "block",
                }}
              >
                District
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  background: "#fff",
                  color: COLORS.text,
                  fontSize: 14,
                }}
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sliders */}
            {[
              ["population_lakhs", "Population (lakhs)", 0, 200, 0.1],
              ["literacy_rate", "Literacy %", 0, 100, 0.1],
              ["pupil_teacher_ratio", "Pupil-Teacher Ratio", 0, 100, 0.1],
              ["teacher_difference", "Teacher Difference", 0, 100, 0.1],
            ].map(([key, label, min, max, step]) => (
              <div
                key={key}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: COLORS.muted }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: COLORS.text,
                      fontWeight: 600,
                    }}
                  >
                    {mlInput[key].toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={mlInput[key]}
                  onChange={(e) =>
                    setMlInput((p) => ({ ...p, [key]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              onClick={runPrediction}
              style={{
                padding: "10px 14px",
                background: COLORS.primary,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Predict & Update Map
            </button>
            <button
              onClick={downloadPDF}
              style={{
                padding: "10px 14px",
                background: "#0B3D91",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Download PDF
            </button>
            <button
              onClick={async () => {
                try {
                  setExplLoading(true);
                  setExplError("");
                  const res = await axios.post("/api/ml/explain", mlInput);
                  setExpl(res.data || null);
                } catch (err) {
                  console.error("Explain failed", err);
                  setExplError("Explain service unavailable");
                } finally {
                  setExplLoading(false);
                }
              }}
              style={{
                padding: "10px 14px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Explain Prediction
            </button>
            <button
              onClick={resetAll}
              style={{
                padding: "10px 14px",
                background: "#6B7280",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>

          {/* Explainability panel */}
          {explLoading && (
            <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
              Explaining…
            </div>
          )}
          {explError && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#b91c1c",
                background: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: 8,
              }}
            >
              {explError}
            </div>
          )}
          {expl && expl.contributions && (
            <div
              style={{
                marginTop: 14,
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div
                style={{ fontWeight: 700, color: COLORS.text, marginBottom: 6 }}
              >
                Why this inequality?
              </div>
              <div
                style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}
              >
                Red increases inequality; Blue reduces inequality.
              </div>
              {(() => {
                const entries = Object.entries(expl.contributions);
                if (!entries.length) return null;
                const maxAbs =
                  Math.max(
                    ...entries.map(([, v]) => Math.abs(Number(v) || 0)),
                  ) || 1;
                return entries.map(([k, v]) => {
                  const val = Number(v) || 0;
                  const pct = Math.min(
                    100,
                    Math.max(5, Math.round((Math.abs(val) / maxAbs) * 100)),
                  );
                  const isIncrease = val >= 0;
                  const barColor = isIncrease ? "#ef4444" : "#2563eb";
                  const label = k
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 12, color: COLORS.text }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 12, color: COLORS.muted }}>
                          {val.toFixed(3)} {isIncrease ? "↑" : "↓"}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: "#e5e7eb",
                          borderRadius: 6,
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: barColor,
                            borderRadius: 6,
                          }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Hidden PDF Report canvas */}
      {showReport &&
        (() => {
          const key = canonicalName(selectedDistrict);
          const baseEII =
            baselinePred[key]?.inequality_index ?? baselinePred[key]?.EII;
          const currEII =
            districtPred[key]?.inequality_index ?? districtPred[key]?.EII;
          const baseLabel =
            typeof baseEII === "number" ? getLabel(baseEII) : "—";
          const currLabel =
            typeof currEII === "number" ? getLabel(currEII) : "—";
          const hasNumbers =
            typeof baseEII === "number" && typeof currEII === "number";
          const deltaVal = hasNumbers ? currEII - baseEII : 0;
          const pctVal =
            hasNumbers && baseEII !== 0 ? (deltaVal / baseEII) * 100 : null;
          const legend = [
            { label: "Excellent", color: "#006400" },
            { label: "Moderate", color: "#FFD700" },
            { label: "Poor", color: "#FF8C00" },
            { label: "Critical", color: "#8B0000" },
          ];
          return (
            <div
              ref={reportRef}
              style={{
                position: "fixed",
                left: -10000,
                top: -10000,
                width: 800,
                background: "#fff",
                color: "#111827",
                fontFamily: "Inter, system-ui, Arial, sans-serif",
                padding: 24,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{ fontSize: 20, fontWeight: 800, color: "#0B3D91" }}
                  >
                    EduMap — District Report
                  </div>
                  <div style={{ fontSize: 14, color: "#6B7280" }}>
                    Educational Inequality Index (EII)
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{selectedDistrict}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    {new Date().toLocaleString()}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.8fr",
                  gap: 16,
                }}
              >
                {/* Left: Baseline vs Simulated */}
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    Baseline vs Simulated
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        background: "#f9fafb",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        Baseline EII
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>
                        {typeof baseEII === "number" ? baseEII.toFixed(3) : "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {baseLabel}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f9fafb",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        Simulated EII
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>
                        {typeof currEII === "number" ? currEII.toFixed(3) : "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {currLabel}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
                    <div
                      style={{
                        background: "#f9fafb",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        Change
                      </div>
                      <div style={{ fontWeight: 800 }}>
                        {hasNumbers
                          ? `${deltaVal.toFixed(3)} (${pctVal !== null ? pctVal.toFixed(1) + "%" : "—"})`
                          : "—"}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f9fafb",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        Status
                      </div>
                      <div style={{ fontWeight: 800 }}>
                        {typeof baseEII === "number" &&
                        typeof currEII === "number"
                          ? `${baseLabel} → ${currLabel}`
                          : baseLabel}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Sliders used */}
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    Sliders Used
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <strong>Population (lakhs):</strong>{" "}
                      {mlInput.population_lakhs.toFixed(1)}
                    </div>
                    <div>
                      <strong>Literacy %:</strong>{" "}
                      {mlInput.literacy_rate.toFixed(1)}
                    </div>
                    <div>
                      <strong>Pupil-Teacher Ratio:</strong>{" "}
                      {mlInput.pupil_teacher_ratio.toFixed(1)}
                    </div>
                    <div>
                      <strong>Teacher Difference:</strong>{" "}
                      {mlInput.teacher_difference.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Color Legend
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {legend.map((l) => (
                        <div
                          key={l.label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              background: l.color,
                              borderRadius: 4,
                            }}
                          />
                          <div style={{ fontSize: 12 }}>{l.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 14 }}>
                Generated by EduMap • Lower EII indicates lower inequality
              </div>
            </div>
          );
        })()}
    </div>
  );
}
