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

const GOV_NAVY = "#0A3A67";
const CARD_BG = "#f8fafc";

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
function SimpleBarChart({ metrics = [], width = 420, height = 110 }) {
  const padding = 10;
  const barH = Math.floor((height - padding * 2) / metrics.length) - 8;
  return (
    <svg width={width} height={height} style={{ background: "transparent" }}>
      {metrics.map((m, i) => {
        const y = padding + i * (barH + 8);
        const w = Math.round(((m.value || 0) / 100) * (width - 150));
        return (
          <g key={m.label}>
            <text x={6} y={y + barH / 1.6} fontSize={12} fill="#374151">
              {m.label}
            </text>
            <rect
              x={140}
              y={y}
              width={w}
              height={barH}
              rx={4}
              fill={m.color || GOV_NAVY}
            />
            <text
              x={140 + w + 8}
              y={y + barH / 1.6}
              fontSize={11}
              fill="#374151"
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
      { label: "Literacy", value: Math.round(literacy), color: GOV_NAVY },
      {
        label: "School Enrolment",
        value: Math.round(enrolment),
        color: GOV_NAVY,
      },
      { label: "Infrastructure", value: Math.round(infra), color: GOV_NAVY },
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
      ? "#88C0D0"
      : score === 2
      ? "#d9534f"
      : score === 1
      ? "#f0ad4e"
      : score === 0
      ? "#28a745"
      : "#e5e7eb";
    return {
      fillColor,
      color: GOV_NAVY,
      weight: 1,
      fillOpacity: isSel ? 0.95 : 0.85,
    };
  };

  // Layout styles (simple grid)
  const containerStyle = {
    display: "grid",
    gridTemplateColumns: "320px 1fr 320px",
    gap: 18,
    padding: 18,
    minWidth: 0,
    alignItems: "start",
  };
  const cardStyle = {
    background: "#fff",
    padding: 12,
    border: "1px solid #e6eef6",
    borderRadius: 8,
  };

  if (loading) return <>Loading...</>;
  if (error) return <>Error: {error}</>;

  const sel = stateData[selectedState] || {};
  const selName = sel.name || selectedState || "";
  const selScore = sel.score !== undefined ? sel.score : null;

  return (
    <div style={{ padding: 12 }}>
      <div style={containerStyle}>
        {/* left column */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Select State
            </label>
            <select
              value={selectedState || ""}
              onChange={(e) => setSelectedState(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e6eef6",
                borderRadius: 6,
                background: "#fff",
                fontSize: 14,
                color: "#111827",
              }}
            >
              {stateOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...cardStyle, background: CARD_BG, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  Inequality Score
                </div>
                <div style={{ fontSize: 40, fontWeight: 700, color: GOV_NAVY }}>
                  {selScore !== null ? selScore : "N/A"}
                </div>
                <div style={{ marginTop: 6, color: "#374151" }}>
                  {statusFromScore(selScore)}
                </div>
              </div>
              <div style={{ textAlign: "right", maxWidth: 220 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Overview</div>
                <div style={{ marginTop: 8, color: "#374151" }}>
                  {selScore !== null
                    ? selScore === 2
                      ? "This state shows very high inequality. Focus on improving infrastructure and retention."
                      : selScore === 1
                      ? "Medium inequality. Targeted district programs will help."
                      : "Low inequality. Continue good policies and monitoring."
                    : "No score available."}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 700, color: GOV_NAVY }}>
                Key Metrics
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Values shown as %
              </div>
            </div>
            <SimpleBarChart metrics={metricsForState} />
          </div>

          <div style={{ ...cardStyle }}>
            <div style={{ fontWeight: 700, color: GOV_NAVY }}>
              Possible Insights
            </div>
            <div style={{ marginTop: 8, color: "#374151" }}>
              {insightForState.short}
            </div>
            <ul style={{ marginTop: 8, color: "#374151" }}>
              {insightForState.reasons.map((r, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* middle column (map + districts) */}
        <div>
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: GOV_NAVY }}>State Map</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{selName}</div>
            </div>

            <div style={{ height: 380, borderRadius: 6, overflow: "hidden" }}>
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
                      fillColor: "#dbeafe",
                      color: GOV_NAVY,
                      weight: 1,
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

          <div style={{ ...cardStyle }}>
            <div style={{ fontWeight: 700, color: GOV_NAVY, marginBottom: 8 }}>
              Districts
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e6eef6",
                    }}
                  >
                    <th style={{ padding: "8px 6px" }}>District</th>
                    <th style={{ padding: "8px 6px", width: 120 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {districtsForState.length === 0 && (
                    <tr>
                      <td
                        style={{ padding: "8px 6px", color: "#6b7280" }}
                        colSpan={2}
                      >
                        No district data for this state.
                      </td>
                    </tr>
                  )}
                  {districtsForState.map((d) => (
                    <tr
                      key={d.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "8px 6px" }}>{d.name}</td>
                      <td
                        style={{
                          padding: "8px 6px",
                          fontWeight: 700,
                          color:
                            d.score === 2
                              ? "#d9534f"
                              : d.score === 1
                              ? "#f0ad4e"
                              : "#28a745",
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
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: GOV_NAVY }}>
              State Summary
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#374151", fontWeight: 700 }}>{selName}</div>
              <div style={{ color: "#6b7280", marginTop: 6 }}>
                {selScore !== null ? `Score: ${selScore}` : "Score not set"}
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  style={{
                    background: GOV_NAVY,
                    color: "#fff",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle }}>
            <div style={{ fontWeight: 700, color: GOV_NAVY, marginBottom: 8 }}>
              Quick Insights
            </div>
            <div style={{ color: "#374151" }}>{insightForState.short}</div>
            <ul style={{ marginTop: 8, color: "#374151" }}>
              {insightForState.reasons.map((r, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
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
