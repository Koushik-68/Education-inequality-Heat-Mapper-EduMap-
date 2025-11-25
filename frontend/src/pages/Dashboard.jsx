// C:/Users/Admin/Desktop/EduMap-main/frontend/src/pages/Dashboard.jsx
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
const GEOJSON_URL = "/api/india-simplified.topojson"; // in frontend/public/api
const DATA_URL = "/data/data.json";

const GOV_NAVY = "#0A3A67";
const COLORS = {
  low: "#28a745",
  medium: "#f0ad4e",
  high: "#d9534f",
  default: "#e5e7eb",
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
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 10);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [20, 20] });
      } catch (e) {
        // ignore
      }
    } else if (center && zoom) {
      map.setView(center, zoom);
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

// Floating Info Panel - legend and details
const MapFloatingInfoPanel = ({ selectedState, stateData, onResetView }) => {
  const sd = selectedState && stateData[selectedState];
  const stateName = sd?.name || "State";

  return (
    <div
      className="leaflet-top"
      style={{
        zIndex: 1100,
        padding: 10,
        left: 20,
        top: 20,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          width: 240,
          background: "#ffffff",
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          marginBottom: 10,
          color: "#111827",
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
          fontSize: 13,
          lineHeight: "1.3",
        }}
      >
        <div style={{ fontWeight: 700, color: GOV_NAVY, marginBottom: 8 }}>
          Legend
        </div>

        {/* Legend items */}
        {[
          { color: COLORS.low, text: "Low inequality (Score 0)" },
          { color: COLORS.medium, text: "Medium inequality (Score 1)" },
          { color: COLORS.high, text: "Very high inequality (Score 2)" },
        ].map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 8,
              color: "#111827",
              whiteSpace: "normal",
            }}
          >
            <div
              style={{
                width: 20,
                height: 12,
                background: item.color,
                border: "1px solid #d1d5db",
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>{item.text}</div>
          </div>
        ))}

        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#111827" }}>
            Selected State
          </div>
          {sd ? (
            <div>
              <div style={{ fontWeight: 700, color: GOV_NAVY, fontSize: 14 }}>
                {stateName} ({selectedState})
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#111827" }}>
                Score: {sd.score}
              </div>
              <button
                onClick={onResetView}
                style={{
                  background: GOV_NAVY,
                  color: "#fff",
                  padding: "6px 10px",
                  border: "none",
                  borderRadius: 4,
                  marginTop: 10,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Reset View
              </button>
            </div>
          ) : (
            <div style={{ color: "#525252", fontSize: 13 }}>
              Click a state on the map to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

  // initial map center/zoom
  const INITIAL_CENTER = [22, 79];
  const INITIAL_ZOOM = 5;

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

  // resetMapView cleanup effect (proper place)
  useEffect(() => {
    if (resetMapView) {
      const timer = setTimeout(() => setResetMapView(false), 100);
      return () => clearTimeout(timer);
    }
  }, [resetMapView]);

  // Choropleth style
  const stateStyle = (feature) => {
    const key = getStateKeyFromFeature(feature.properties, stateData);
    const score = key && stateData[key] ? stateData[key].score : -1;
    return {
      fillColor: getColorForScore(score),
      color: GOV_NAVY,
      weight: 1,
      fillOpacity: 0.85,
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
        e.target.setStyle({ weight: 2, color: "#333" });
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
  const HEADER_HEIGHT = 70;
  const SIDEBAR_WIDTH = 288; // Match Sidebar w-72 (18rem = 288px)
  const containerStyle = {
    display: "flex",
    height: `calc(100vh - ${HEADER_HEIGHT}px)`,
    width: "100vw",
    overflow: "hidden",
  };

  return (
    <div style={{ margin: 0, padding: 0 }}>
      {/* Header */}
      <header
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 18px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="11" fill={GOV_NAVY} />
              <path
                d="M9 12l2 2 4-4"
                stroke="#fff"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Government of India
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GOV_NAVY }}>
              EduMap — Educational Inequality Dashboard
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              background: GOV_NAVY,
              color: "#fff",
              padding: "8px 12px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Download Report
          </button>
          <button
            style={{
              background: "#334155",
              color: "#fff",
              padding: "8px 12px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Help
          </button>
        </div>
      </header>

      {/* Main container: sidebar + map area */}
      <div style={containerStyle}>
        {/* Sidebar */}
        <div style={{ width: SIDEBAR_WIDTH, height: "100%", flexShrink: 0 }}>
          <Sidebar active="Dashboard" />
        </div>

        {/* Main area */}
        <main
          style={{
            flexGrow: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                position: "relative",
              }}
            >
              <MapContainer
                center={INITIAL_CENTER}
                zoom={INITIAL_ZOOM}
                style={{ width: "100%", height: "100%" }}
                scrollWheelZoom={true}
              >
                <ChangeMapView
                  bounds={mapBounds}
                  center={resetMapView ? INITIAL_CENTER : undefined}
                  zoom={resetMapView ? INITIAL_ZOOM : undefined}
                />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />

                {/* Floating Info Panel */}
                <MapFloatingInfoPanel
                  selectedState={selectedState}
                  stateData={stateData}
                  onResetView={resetView}
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
            border: "1px solid #e5e7eb",
            padding: 10,
            borderRadius: 6,
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
            border: "1px solid #fca5a5",
            padding: 10,
            borderRadius: 6,
            color: "#9b1c1c",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
