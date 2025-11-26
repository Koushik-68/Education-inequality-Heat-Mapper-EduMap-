// src/pages/StateSummary.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
// import Sidebar from "../component/Sidebar.jsx";
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

/* ---------- Config ---------- */
const GEOJSON_URL = "/api/india-simplified.topojson";
const DATA_URL = "/data/data.json";

// Updated Colors for a richer, modern look
const PRIMARY_BLUE = "#0056B3"; // Darker, more professional blue
const ACCENT_COLOR = "#00BFA5"; // Teal/Cyan for success (Score 0)
const WARNING_COLOR = "#FFC107"; // Amber for medium (Score 1)
const DANGER_COLOR = "#DC3545"; // Red for very high (Score 2)
const BACKGROUND_LIGHT = "#F4F7F9"; // Very light grey/blue for background
const CARD_BG = "#FFFFFF"; // Pure white for cards
const TEXT_DARK = "#212529"; // Near-black for main text
const TEXT_MUTED = "#6C757D"; // Muted grey for secondary text
const BORDER_LIGHT = "#DEE2E6"; // Subtle border color

const GOV_NAVY = PRIMARY_BLUE; // Retain GOV_NAVY variable, but use the new primary blue

/* Fix leaflet icons for Vite */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/* Helpers */

// Status text from score
const statusFromScore = (s) =>
  s === 2 ? "Very High (Needs urgent help)" : s === 1 ? "Medium" : "Low";

// Try to find a state code for a given feature's properties OR match by name
function matchFeatureToStateCode(props = {}, stateData = {}) {
  if (!props) return null;

  const keys = [
    "STATE_CODE",
    "state_code",
    "ST_CODE",
    "state",
    "STATE",
    "st_nm",
    "NAME",
    "ST_NM",
  ];
  for (const k of keys) {
    const v = props[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (stateData[s]) return s;
      const up = s.toUpperCase();
      if (stateData[up]) return up;
    }
  }

  if (props.NAME) {
    const name = String(props.NAME).trim().toLowerCase();
    for (const code of Object.keys(stateData)) {
      const sdName = (stateData[code] && stateData[code].name) || "";
      if (sdName.toLowerCase() === name) return code;
    }
  }

  return null;
}

/* Fit bounds helper used inside Map */
function FitToBounds({ geometry }) {
  const map = useMap();
  useEffect(() => {
    if (!geometry) return;
    try {
      const layer = L.geoJSON(geometry);
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (e) {
      // ignore
    }
  }, [geometry, map]);
  return null;
}

/* Small inline bar chart */
// Reduced width and height to fit better in the constrained left column
function SimpleBarChart({ metrics = [], width = 300, height = 90 }) {
  const padding = 10;
  const barH = Math.floor((height - padding * 2) / metrics.length) - 8;
  // Adjusted constant for label width
  const LABEL_WIDTH = 120;
  const BAR_START_X = LABEL_WIDTH + 8;
  const CHART_AREA_WIDTH = width - BAR_START_X - 50;

  return (
    <svg width={width} height={height} style={{ background: "transparent" }}>
      {metrics.map((m, i) => {
        const y = padding + i * (barH + 12);
        // Calculate bar width based on available chart area
        const w = Math.round(((m.value || 0) / 100) * CHART_AREA_WIDTH);
        return (
          <g key={m.label}>
            <text
              x={6}
              y={y + barH / 1.6}
              fontSize={13}
              fill={TEXT_DARK}
              fontWeight={500}
            >
              {m.label}
            </text>
            {/* Background track */}
            <rect
              x={BAR_START_X}
              y={y}
              width={CHART_AREA_WIDTH}
              height={barH}
              rx={4}
              fill={BORDER_LIGHT}
            />
            {/* Value bar */}
            <rect
              x={BAR_START_X}
              y={y}
              width={w}
              height={barH}
              rx={4}
              fill={m.color || PRIMARY_BLUE}
            />
            {/* Value label */}
            <text
              x={BAR_START_X + CHART_AREA_WIDTH + 8} // Position after the max bar track
              y={y + barH / 1.6}
              fontSize={12}
              fontWeight={600}
              fill={TEXT_DARK}
            >
              {(m.value || 0).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Main Component ---------- */
export default function StateSummary() {
  const [geo, setGeo] = useState(null); // GeoJSON FeatureCollection
  const [stateData, setStateData] = useState({});
  const [districtData, setDistrictData] = useState({});

  const [selectedState, setSelectedState] = useState(null); // code like "KA"
  const [selectedFeatureGeometry, setSelectedFeatureGeometry] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);

  // Load files
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [gRes, dRes] = await Promise.all([
          axios.get(GEOJSON_URL),
          axios.get(DATA_URL),
        ]);
        if (cancelled) return;

        // Convert TopoJSON -> GeoJSON if needed
        let geoJson = gRes.data;
        if (geoJson && geoJson.objects) {
          geoJson = topoFeature(
            geoJson,
            geoJson.objects[Object.keys(geoJson.objects)[0]]
          );
        }

        setGeo(geoJson || null);
        const payload = dRes.data || {};
        setStateData(payload.states || {});
        setDistrictData(payload.districts || {});

        // default selection: first state code in stateData
        const first = Object.keys(payload.states || {})[0];
        if (first) setSelectedState(first);

        setError(null);
      } catch (e) {
        console.error("Error loading data:", e);
        setError("Failed to load map or data.");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // State options sorted by name
  const stateOptions = useMemo(() => {
    return Object.entries(stateData)
      .map(([code, s]) => ({ code, name: s.name || code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [stateData]);

  // Build selected feature geometry
  useEffect(() => {
    if (!geo || !selectedState) {
      setSelectedFeatureGeometry(null);
      return;
    }
    const f = geo.features.find((feature) => {
      const props = feature.properties || {};
      const matched = matchFeatureToStateCode(props, stateData);
      if (
        matched &&
        String(matched).toUpperCase() === String(selectedState).toUpperCase()
      )
        return true;

      const sd = stateData[selectedState] && stateData[selectedState].name;
      if (
        sd &&
        props.NAME &&
        String(props.NAME).toLowerCase() === String(sd).toLowerCase()
      )
        return true;
      if (
        sd &&
        props.st_nm &&
        String(props.st_nm).toLowerCase() === String(sd).toLowerCase()
      )
        return true;

      return false;
    });

    if (f) setSelectedFeatureGeometry(f);
    else setSelectedFeatureGeometry(null);
  }, [geo, selectedState, stateData]);

  // metrics
  const metricsForState = useMemo(() => {
    const sd = stateData[selectedState] || {};
    const baseScore = sd.score !== undefined ? sd.score : 1;
    const literacy = sd.literacy_pct ?? Math.max(30, 82 - baseScore * 12);
    const enrolment = sd.enrolment_pct ?? Math.max(30, 80 - baseScore * 10);
    const infra = sd.infra_index_pct ?? Math.max(20, 70 - baseScore * 8);
    return [
      { label: "Literacy", value: Math.round(literacy), color: PRIMARY_BLUE },
      {
        label: "School Enrolment",
        value: Math.round(enrolment),
        color: PRIMARY_BLUE,
      },
      {
        label: "Infrastructure",
        value: Math.round(infra),
        color: PRIMARY_BLUE,
      },
    ];
  }, [stateData, selectedState]);

  const districtsForState = useMemo(
    () => (districtData[selectedState] || []).slice(),
    [districtData, selectedState]
  );

  const insightForState = useMemo(() => {
    const sd = stateData[selectedState] || {};
    const sc = sd.score;
    if (sc === 2) {
      return {
        short: "Very high inequality — priority attention required.",
        reasons: [
          "Infrastructure shortfall in many rural districts.",
          "Higher dropout rates in secondary levels.",
          "Gender and access gaps in remote areas.",
        ],
      };
    }
    if (sc === 1) {
      return {
        short: "Medium inequality — targeted interventions recommended.",
        reasons: [
          "Uneven school access across districts",
          "Need to improve teacher deployment",
        ],
      };
    }
    return {
      short: "Low inequality — state performing well.",
      reasons: ["Strong primary enrolment", "Good local programmes"],
    };
  }, [stateData, selectedState]);

  // GeoJSON style
  const geoStyle = (feature) => {
    const props = feature.properties || {};
    const code = matchFeatureToStateCode(props, stateData);
    const sd = code ? stateData[code] : null;
    const score = sd ? sd.score : -1;
    const isSel =
      code &&
      selectedState &&
      String(code).toUpperCase() === String(selectedState).toUpperCase();
    const fillColor = isSel
      ? "#6CB8F7" // A brighter blue for selection
      : score === 2
      ? DANGER_COLOR
      : score === 1
      ? WARNING_COLOR
      : score === 0
      ? ACCENT_COLOR
      : BORDER_LIGHT; // Default neutral color
    return {
      fillColor,
      color: PRIMARY_BLUE, // Darker border for map
      weight: isSel ? 2 : 1, // Thicker border for selected state
      fillOpacity: isSel ? 0.95 : 0.85,
    };
  };

  // Layout styles (simple grid)
  const containerStyle = {
    display: "grid",
    // Adjusted middle column to be larger, consuming more available space
    gridTemplateColumns: "340px 1.5fr 300px",
    gap: 20,
    padding: 24,
    minWidth: 0,
    alignItems: "start",
    background: BACKGROUND_LIGHT,
    minHeight: "100vh",
  };
  const cardStyle = {
    background: CARD_BG,
    padding: 20,
    border: `1px solid ${BORDER_LIGHT}`,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
  };

  if (loading)
    return (
      <div style={{ padding: 24, background: BACKGROUND_LIGHT }}>
        Loading...
      </div>
    );
  if (error)
    return (
      <div style={{ padding: 24, background: BACKGROUND_LIGHT }}>
        Error: {error}
      </div>
    );

  const sel = stateData[selectedState] || {};
  const selName = sel.name || selectedState || "";
  const selScore = sel.score !== undefined ? sel.score : null;

  // Custom style for the Score Card
  const scoreCardStyle = {
    ...cardStyle,
    background: PRIMARY_BLUE,
    color: CARD_BG,
    marginBottom: 20,
    boxShadow: "0 8px 16px rgba(0, 86, 179, 0.2)",
  };

  // Custom style for District table rows
  const getDistrictRowColor = (score) => {
    switch (score) {
      case 2:
        return DANGER_COLOR;
      case 1:
        return WARNING_COLOR;
      case 0:
        return ACCENT_COLOR;
      default:
        return TEXT_DARK;
    }
  };

  // Reduced map height
  const MAP_HEIGHT = 380; // Decreased from 560 to 380

  return (
    <div style={{ background: BACKGROUND_LIGHT }}>
      <div style={containerStyle}>
        {/* left column */}
        <div>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: TEXT_DARK,
                marginBottom: 8,
              }}
            >
              Select State
            </label>
            <select
              value={selectedState || ""}
              onChange={(e) => setSelectedState(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: `1px solid ${BORDER_LIGHT}`,
                borderRadius: 8,
                background: CARD_BG,
                fontSize: 15,
                color: TEXT_DARK,
                appearance: "none",
                cursor: "pointer",
              }}
            >
              {stateOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>

          {/* Inequality Score Card */}
          <div style={scoreCardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 14, color: "#e6eef6", fontWeight: 500 }}
                >
                  Inequality Score
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, color: CARD_BG }}>
                  {selScore !== null ? selScore : "N/A"}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: CARD_BG,
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {statusFromScore(selScore)}
                </div>
              </div>
              <div style={{ textAlign: "right", maxWidth: 180 }}>
                <div style={{ fontSize: 13, color: "#e6eef6" }}>Overview</div>
                <div style={{ marginTop: 8, color: CARD_BG, fontSize: 14 }}>
                  {selScore !== null
                    ? selScore === 2
                      ? "This state shows **very high** inequality. Focus on improving infrastructure and retention."
                      : selScore === 1
                      ? "Medium inequality. Targeted district programs will help."
                      : "Low inequality. Continue good policies and monitoring."
                    : "No score available."}
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Card */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
                alignItems: "baseline",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: PRIMARY_BLUE,
                  fontSize: 18,
                }}
              >
                Key Metrics
              </div>
              <div style={{ fontSize: 13, color: TEXT_MUTED }}>
                Values shown as %
              </div>
            </div>
            {/* The SimpleBarChart width is now set to 300 in its definition */}
            <SimpleBarChart metrics={metricsForState} />
          </div>

          {/* Insights Card (Left Column) */}
          <div style={{ ...cardStyle }}>
            <div
              style={{
                fontWeight: 700,
                color: PRIMARY_BLUE,
                fontSize: 18,
                marginBottom: 10,
              }}
            >
              Possible Insights
            </div>
            <div style={{ marginTop: 8, color: TEXT_DARK, fontWeight: 600 }}>
              {insightForState.short}
            </div>
            <ul style={{ marginTop: 12, color: TEXT_DARK, paddingLeft: 20 }}>
              {insightForState.reasons.map((r, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* middle column (map + districts) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {" "}
          {/* Added flex column to manage vertical space */}
          {/* Map Card */}
          <div style={{ ...cardStyle, padding: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
                padding: "8px 8px",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: PRIMARY_BLUE,
                  fontSize: 18,
                }}
              >
                State Map
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: TEXT_MUTED,
                  fontWeight: 600,
                }}
              >
                {selName}
              </div>
            </div>

            <div
              style={{
                height: MAP_HEIGHT,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <MapContainer
                center={[22, 79]}
                zoom={5}
                style={{ width: "100%", height: "100%" }}
                whenCreated={(map) => {
                  mapRef.current = map;
                  setTimeout(() => map.invalidateSize(), 120);
                }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {geo ? (
                  <GeoJSON
                    data={geo}
                    style={geoStyle}
                    key={selectedState || "all"}
                    onEachFeature={(feature, layer) => {
                      const props = feature.properties || {};
                      const code = matchFeatureToStateCode(props, stateData);
                      const sd = code ? stateData[code] : null;
                      const name =
                        sd?.name || props.NAME || props.st_nm || "State";
                      layer.bindPopup(
                        `<strong>${name}</strong><br/>Score: ${
                          sd ? sd.score : "N/A"
                        }`
                      );
                      layer.on("click", () => {
                        if (!mapRef.current) return;
                        const bounds = layer.getBounds
                          ? layer.getBounds()
                          : null;
                        if (bounds)
                          mapRef.current.fitBounds(bounds, {
                            padding: [20, 20],
                          });
                      });
                    }}
                  />
                ) : null}

                {selectedFeatureGeometry ? (
                  <GeoJSON
                    data={selectedFeatureGeometry}
                    style={{
                      fillColor: "#e0f2fe",
                      color: PRIMARY_BLUE,
                      weight: 2,
                      fillOpacity: 0.9,
                    }}
                  />
                ) : null}

                {selectedFeatureGeometry ? (
                  <FitToBounds geometry={selectedFeatureGeometry} />
                ) : null}

                {districtsForState.map((d) => (
                  <Marker key={d.id} position={[d.lat, d.lng]}>
                    <Popup>
                      <b>{d.name}</b>
                      <div>Score: {d.score}</div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
          {/* Districts Table Card */}
          {/* Changed to flex-grow to fill available vertical space, and removed maxHeight */}
          <div style={{ ...cardStyle, flexGrow: 1 }}>
            <div
              style={{
                fontWeight: 700,
                color: PRIMARY_BLUE,
                marginBottom: 10,
                fontSize: 18,
              }}
            >
              Districts
            </div>
            <div
              style={{
                height: "100%", // Allow content to stretch vertically
                overflowY: "auto",
                padding: "0 8px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: "0 4px",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      borderBottom: `2px solid ${BORDER_LIGHT}`,
                      background: BACKGROUND_LIGHT,
                    }}
                  >
                    <th
                      style={{
                        padding: "10px 12px",
                        color: TEXT_MUTED,
                        fontWeight: 600,
                        borderTopLeftRadius: 6,
                        borderBottomLeftRadius: 6,
                      }}
                    >
                      District
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        width: 120,
                        color: TEXT_MUTED,
                        fontWeight: 600,
                        borderTopRightRadius: 6,
                        borderBottomRightRadius: 6,
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {districtsForState.length === 0 && (
                    <tr>
                      <td
                        style={{
                          padding: "8px 12px",
                          color: TEXT_MUTED,
                          fontStyle: "italic",
                        }}
                        colSpan={2}
                      >
                        No district data for this state.
                      </td>
                    </tr>
                  )}
                  {districtsForState.map((d) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: "1px solid transparent",
                        background: CARD_BG,
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          color: TEXT_DARK,
                          borderTopLeftRadius: 6,
                          borderBottomLeftRadius: 6,
                        }}
                      >
                        {d.name}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontWeight: 700,
                          color: getDistrictRowColor(d.score),
                          borderTopRightRadius: 6,
                          borderBottomRightRadius: 6,
                        }}
                      >
                        {d.score === 2
                          ? "Very High"
                          : d.score === 1
                          ? "Medium"
                          : "Low"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* right column */}
        <aside>
          {/* State Summary Card */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div
              style={{
                fontWeight: 700,
                color: PRIMARY_BLUE,
                fontSize: 18,
              }}
            >
              State Summary
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ color: TEXT_DARK, fontWeight: 700, fontSize: 16 }}>
                {selName}
              </div>
              <div style={{ color: TEXT_MUTED, marginTop: 4, fontSize: 14 }}>
                {selScore !== null ? `Score: ${selScore}` : "Score not set"}
              </div>
              <div style={{ marginTop: 20 }}>
                <button
                  style={{
                    background: PRIMARY_BLUE,
                    color: CARD_BG,
                    padding: "10px 16px",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background 0.3s ease",
                    boxShadow: "0 4px 8px rgba(0, 86, 179, 0.3)",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "#004085")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = PRIMARY_BLUE)
                  }
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Quick Insights Card (Right Column) */}
          <div style={{ ...cardStyle }}>
            <div
              style={{
                fontWeight: 700,
                color: PRIMARY_BLUE,
                marginBottom: 10,
                fontSize: 18,
              }}
            >
              Quick Insights
            </div>
            <div style={{ color: TEXT_DARK, fontWeight: 600 }}>
              {insightForState.short}
            </div>
            <ul style={{ marginTop: 12, color: TEXT_DARK, paddingLeft: 20 }}>
              {insightForState.reasons.map((r, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
