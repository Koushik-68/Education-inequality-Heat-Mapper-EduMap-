// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { feature as topoFeature } from "topojson-client";
import Sidebar from "../component/Sidebar.jsx";

/* -------------------------
   Config & Helpers
   ------------------------- */
// (only colors/styles changed from original — logic untouched)
const GEOJSON_URL = "/api/india-simplified.topojson"; // in frontend/public/api
const DATA_URL = "/data/data.json";

const GOV_NAVY = "#0B3D91"; // richer navy
const DARK_GREY = "#263244"; // deeper grey-blue
const BORDER_GREY = "#e6eef8";
const CARD_BG = "rgba(255,255,255,0.96)";
const SOFT_SHADOW = "0 6px 18px rgba(18,37,73,0.08)";

const COLORS = {
  low: "#16a34a",
  medium: "#f59e0b",
  high: "#e11d48",
  default: "#f8fafc",
};

const getColorForScore = (score) => {
  if (score === 2) return COLORS.high;
  if (score === 1) return COLORS.medium;
  if (score === 0) return COLORS.low;
  return COLORS.default;
};

/* Fix leaflet marker icons for Vite/Cra */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/* Map View Changer (with map.invalidateSize fix) */
const ChangeMapView = ({ bounds, center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    // ensure map size recalculation after layout changes
    const t = setTimeout(() => map.invalidateSize(), 10);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (bounds) {
      try {
        if (map.flyToBounds) {
          map.flyToBounds(bounds, {
            padding: [20, 20],
            animate: true,
            duration: 1.0,
          });
        } else {
          map.fitBounds(bounds, { padding: [20, 20], animate: true });
        }
        return;
      } catch (e) {
        // fallback silently
      }
    }

    if (center && typeof zoom === "number") {
      try {
        map.flyTo(center, zoom, { animate: true, duration: 1.0 });
      } catch (e) {
        map.setView(center, zoom);
      }
    }
  }, [bounds, center, zoom, map]);

  return null;
};

/* Helper: match the feature to your stateData using STATE_CODE or name */
const getStateKeyFromFeature = (props = {}, stateData = {}) => {
  if (!props) return null;

  if (props.STATE_CODE !== undefined && stateData[String(props.STATE_CODE)]) {
    return String(props.STATE_CODE);
  }

  const candidates = ["state_code", "STATE", "ST_NM", "NAME", "st_nm"];
  for (const k of candidates) {
    if (props[k]) {
      const val = String(props[k]).trim();
      if (stateData[val]) return val;

      const low = val.toLowerCase();
      for (const code of Object.keys(stateData || {})) {
        if (
          stateData[code] &&
          stateData[code].name &&
          stateData[code].name.toLowerCase() === low
        ) {
          return code;
        }
      }
    }
  }
  return null;
};

export default function Dashboard() {
  // Geo + data
  const [geo, setGeo] = useState(null);
  const [stateData, setStateData] = useState({});
  const [districtData, setDistrictData] = useState({});

  // selection + view
  const [selectedState, setSelectedState] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [resetMapView, setResetMapView] = useState(false);

  // initial map center/zoom (slightly zoomed out)
  const INITIAL_CENTER = [22, 79];
  const INITIAL_ZOOM = 4.3; // more of the country visible by default

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const geoRef = useRef();

  // Data fetch
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [gRes, dRes] = await Promise.all([
          axios.get(GEOJSON_URL),
          axios.get(DATA_URL),
        ]);
        if (cancelled) return;

        let geoJsonObj;
        if (gRes.data && gRes.data.objects) {
          const topo = gRes.data;
          const firstKey = Object.keys(topo.objects)[0];
          geoJsonObj = topoFeature(topo, topo.objects[firstKey]);
        } else {
          geoJsonObj = gRes.data;
        }

        setGeo(geoJsonObj);
        setStateData(dRes.data.states || {});
        setDistrictData(dRes.data.districts || {});
        setError(null);
      } catch (e) {
        console.error("Error loading map/data:", e);
        setError("Failed to load map or data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // resetMapView cleanup effect
  useEffect(() => {
    if (resetMapView) {
      const timer = setTimeout(() => setResetMapView(false), 120);
      return () => clearTimeout(timer);
    }
  }, [resetMapView]);

  // Choropleth style
  const stateStyle = (feature) => {
    const key = getStateKeyFromFeature(feature.properties, stateData);
    const score = key && stateData[key] ? stateData[key].score : -1;
    return {
      fillColor: getColorForScore(score),
      color: "#cbd5e1",
      weight: 1,
      fillOpacity: 0.95,
      dashArray: "",
    };
  };

  const resetView = () => {
    setSelectedState(null);
    setMapBounds(null);
    setResetMapView(true);
  };

  const onEachState = (feature, layer) => {
    try {
      layer.setStyle(stateStyle(feature));
    } catch (e) {
      console.warn("setStyle failed", e);
    }

    const key = getStateKeyFromFeature(feature.properties, stateData);
    const sd = key ? stateData[key] : null;
    const name =
      sd?.name ||
      feature.properties.NAME ||
      feature.properties.ST_NM ||
      "State";

    layer.bindPopup(`<b>${name}</b><br/>Status: ${sd ? sd.score : "No data"}`);

    layer.on("click", () => {
      const bounds = layer.getBounds ? layer.getBounds() : null;
      setSelectedState(key);
      setMapBounds(bounds);
    });

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 2, color: "#0b2549", fillOpacity: 0.96 });
      },
      mouseout: (e) => {
        try {
          e.target.setStyle(stateStyle(feature));
        } catch (err) {}
      },
    });
  };

  const districtMarkers =
    selectedState && districtData && districtData[selectedState]
      ? districtData[selectedState]
      : [];

  /* -------------------------
      Layout structure
  -------------------------- */
  const HEADER_HEIGHT = 78;
  const SIDEBAR_WIDTH = 300;
  const containerStyle = {
    display: "flex",
    height: `calc(100vh - ${HEADER_HEIGHT}px)`,
    width: "100vw",
    overflow: "hidden",
    background: "#f6fafc",
  };

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        background: "#f6fafc",
        minHeight: "100vh",
        fontFamily: "Inter, 'PT Sans', Arial, sans-serif",
        color: DARK_GREY,
        fontSize: 14,
      }}
    >
      {/* Page-level animations & small helper CSS */}
      <style>
        {`
        .fade-in-up {
          animation: fadeUp 420ms ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .btn-soft {
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 120ms ease;
        }
        .btn-soft:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(11,61,145,0.12); opacity: 0.98; }
        .card-hover { transition: transform 220ms ease, box-shadow 220ms ease; }
        .card-hover:hover { transform: translateY(-6px); box-shadow: ${SOFT_SHADOW}; }
        .map-glass {
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 12px 34px rgba(9,30,66,0.06);
          border: 1px solid rgba(11,61,145,0.06);
        }
        .details-card {
          backdrop-filter: blur(6px);
          background: ${CARD_BG};
        }
        .legend-color {
          box-shadow: inset 0 -8px 18px rgba(0,0,0,0.03);
        }
        `}
      </style>

      {/* Header */}
      <header
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          borderBottom: `3px solid ${GOV_NAVY}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,253,255,0.98))",
          boxSizing: "border-box",
          boxShadow: "0 2px 8px rgba(9,30,66,0.03)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              background: GOV_NAVY,
              boxShadow: "0 6px 18px rgba(11,61,145,0.12)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#fff" />
              <circle cx="12" cy="12" r="6" fill={GOV_NAVY} />
            </svg>
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: GOV_NAVY }}>
              EDUCATIONAL INEQUALITY HEAT MAPPER
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Government of India • Public dashboard
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            className="btn-soft"
            style={{
              background: GOV_NAVY,
              color: "#fff",
              padding: "10px 16px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: "0 8px 30px rgba(11,61,145,0.08)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.98")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Download Report
          </button>
          <button
            className="btn-soft"
            style={{
              background: "transparent",
              color: DARK_GREY,
              padding: "8px 12px",
              border: `1px solid ${BORDER_GREY}`,
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#fff")}
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Help
          </button>
        </div>
      </header>

      {/* Main container: sidebar + map area + details card */}
      <div style={containerStyle}>
        {/* Sidebar */}
        <div
          style={{
            width: SIDEBAR_WIDTH,
            height: "100%",
            flexShrink: 0,
            padding: 18,
          }}
        >
          <Sidebar active="Dashboard" />
        </div>

        {/* Main area: map + details card */}
        <main
          style={{
            flexGrow: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "row",
            gap: 22,
            padding: "22px",
            boxSizing: "border-box",
          }}
        >
          {/* Map Card */}
          <div
            className="map-glass fade-in-up card-hover"
            style={{
              flex: 2,
              background: "#ffffff",
              borderRadius: 10,
              padding: 0,
              display: "flex",
              alignItems: "stretch",
              minHeight: 0,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <MapContainer
              center={INITIAL_CENTER}
              zoom={INITIAL_ZOOM}
              style={{ width: "100%", height: "100%" }}
              scrollWheelZoom={true}
            >
              <ChangeMapView
                bounds={mapBounds || undefined}
                center={resetMapView ? INITIAL_CENTER : undefined}
                zoom={resetMapView ? INITIAL_ZOOM : undefined}
              />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {geo ? (
                <GeoJSON
                  data={geo}
                  style={stateStyle}
                  onEachFeature={onEachState}
                  ref={geoRef}
                />
              ) : null}

              {districtMarkers.map((d) => (
                <Marker key={d.id} position={[d.lat, d.lng]}>
                  <Popup>
                    <div style={{ fontWeight: 700 }}>{d.name}</div>
                    <div>Score: {d.score}</div>
                  </Popup>
                </Marker>
              ))}

              {selectedState && districtMarkers.length > 0 && (
                <Circle
                  center={[districtMarkers[0].lat, districtMarkers[0].lng]}
                  radius={60000}
                  pathOptions={{
                    color: GOV_NAVY,
                    dashArray: "4",
                    fillOpacity: 0.06,
                  }}
                />
              )}
            </MapContainer>
          </div>

          {/* Details Card (right) - compact official style */}
          <div
            className="details-card fade-in-up"
            style={{
              width: 340,
              background: CARD_BG,
              borderRadius: 10,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              border: `1px solid ${BORDER_GREY}`,
              boxSizing: "border-box",
              boxShadow: "0 10px 30px rgba(9,30,66,0.04)",
            }}
          >
            {/* Scrollable area for legend + content */}
            <div
              style={{
                overflowY: "auto",
                maxHeight: "calc(100vh - 240px)",
                paddingRight: 6,
              }}
            >
              {/* Legend + Selected State (moved here) */}
              <div
                style={{
                  width: "100%",
                  background: "#ffffff",
                  padding: 14,
                  border: `1px solid ${BORDER_GREY}`,
                  borderRadius: 8,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{ fontWeight: 800, color: GOV_NAVY, marginBottom: 8 }}
                >
                  Legend
                </div>

                {/* Legend items */}
                {[
                  { color: COLORS.low, text: "Low inequality (Score 0)" },
                  { color: COLORS.medium, text: "Medium inequality (Score 1)" },
                  {
                    color: COLORS.high,
                    text: "Very high inequality (Score 2)",
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      className="legend-color"
                      style={{
                        width: 22,
                        height: 12,
                        background: item.color,
                        border: `1px solid ${BORDER_GREY}`,
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, fontSize: 13, color: DARK_GREY }}>
                      {item.text}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {index === 0
                        ? "Good"
                        : index === 1
                        ? "Watch"
                        : "Critical"}
                    </div>
                  </div>
                ))}

                {/* Selected State Details / CTA */}
                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: 8,
                      color: DARK_GREY,
                    }}
                  >
                    Selected State
                  </div>
                  {selectedState && stateData[selectedState] ? (
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: GOV_NAVY,
                          fontSize: 15,
                          wordBreak: "break-word",
                        }}
                      >
                        {stateData[selectedState].name} ({selectedState})
                      </div>
                      <div
                        style={{ marginTop: 8, fontSize: 13, color: DARK_GREY }}
                      >
                        Score: {stateData[selectedState].score}
                      </div>
                      <button
                        onClick={resetView}
                        className="btn-soft"
                        style={{
                          background: "#fff",
                          color: GOV_NAVY,
                          padding: "10px 12px",
                          border: `1px solid ${GOV_NAVY}`,
                          borderRadius: 8,
                          marginTop: 12,
                          cursor: "pointer",
                          fontSize: 13,
                          width: "100%",
                          fontWeight: 700,
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.opacity = "0.98")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                      >
                        Reset View
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: "#475569", fontSize: 13 }}>
                      Click a state on the map to view details.
                    </div>
                  )}
                </div>
              </div>

              {/* Example District and other compact info below legend */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  marginBottom: 8,
                  color: GOV_NAVY,
                }}
              >
                Example District
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: "#0f172a",
                  marginBottom: 6,
                }}
              >
                76.4
              </div>
              <div style={{ fontSize: 12, color: "#334155", marginBottom: 10 }}>
                District development indicator
              </div>

              <div style={{ width: "100%", marginBottom: 12 }}>
                <div
                  style={{
                    height: 10,
                    background: "#eef2f8",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "76%",
                      height: "100%",
                      background: GOV_NAVY,
                      borderRadius: 999,
                      transition: "width 520ms cubic-bezier(.2,.9,.2,1)",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  marginBottom: 10,
                  color: GOV_NAVY,
                }}
              >
                Primary Reasons
              </div>
              {[
                "Education access",
                "Household income",
                "Teacher shortage",
                "Quality of schools",
              ].map((reason, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ flex: 1, color: DARK_GREY, fontSize: 13 }}>
                    {reason}
                  </div>
                  <div
                    style={{
                      width: 70,
                      height: 8,
                      background: "#eef2f8",
                      borderRadius: 6,
                      marginLeft: 12,
                      marginRight: 6,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(idx + 1) * 22}%`,
                        height: "100%",
                        background: GOV_NAVY,
                        borderRadius: 6,
                        transition: "width 420ms ease",
                      }}
                    />
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {idx + 1}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom area: keep download button visible and not cut */}
            <div style={{ marginTop: 12 }}>
              <button
                className="btn-soft"
                style={{
                  background: GOV_NAVY,
                  color: "#fff",
                  padding: "12px 0",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 14,
                  width: "100%",
                  cursor: "pointer",
                  boxShadow: "0 10px 30px rgba(11,61,145,0.12)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "0.98")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Download Report
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Loading / Error toasts */}
      {loading && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            background: "#fff",
            border: `1px solid ${BORDER_GREY}`,
            padding: 12,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(9,30,66,0.06)",
          }}
        >
          Loading map...
        </div>
      )}
      {error && (
        <div
          style={{
            position: "fixed",
            left: 20,
            bottom: 20,
            background: "#fff",
            border: `1px solid #fca5a5`,
            padding: 10,
            borderRadius: 8,
            color: "#9b1c1c",
            boxShadow: "0 8px 24px rgba(155,28,28,0.06)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
