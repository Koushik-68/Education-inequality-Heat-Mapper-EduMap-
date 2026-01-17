import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { feature as topoFeature } from "topojson-client";

/* -------------------------
   Config
------------------------- */
const GEOJSON_URL = "/api/karnataka-districts.topojson";
// Using ML baseline predictions like StateSummary

const GOV_NAVY = "#0B3D91";
const DARK_GREY = "#263244";
const BORDER_GREY = "#e6eef8";
const CARD_BG = "rgba(255,255,255,0.96)";

const COLORS = {
  low: "#16a34a",
  medium: "#FF8C00",
  high: "#8B0000",
  default: "#f8fafc",
};

const getColorForScore = (score) => {
  if (score === 2) return COLORS.high;
  if (score === 1) return COLORS.medium;
  if (score === 0) return COLORS.low;
  return COLORS.default;
};

// RVCE color scale (simplified 4 bins) for EII (0..1) — same as StateSummary
const getColor = (val) => {
  if (val >= 0.75) return "#006400"; // Excellent (Dark Green)
  if (val >= 0.5) return "#FFD700"; // Moderate (Yellow)
  if (val >= 0.25) return "#FF8C00"; // Poor (Orange)
  return "#8B0000"; // Critical (Red)
};

const getLabel = (val) => {
  if (val >= 0.75) return "Excellent";
  if (val >= 0.5) return "Moderate";
  if (val >= 0.25) return "Poor";
  return "Critical";
};

// Name normalization — mirror StateSummary
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

const canonicalName = (name) => {
  if (!name) return "";
  const trimmed = String(name).trim();
  return NAME_MAP[trimmed] || trimmed;
};

/* -------------------------
   Leaflet marker fix
------------------------- */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/* -------------------------
   Auto-fit Karnataka
------------------------- */
const FitToGeoJSON = ({ geo }) => {
  const map = useMap();

  useEffect(() => {
    if (!geo) return;
    const layer = L.geoJSON(geo);
    const bounds = layer.getBounds();
    if (!bounds.isValid()) return;

    map.fitBounds(bounds, { animate: false });

    setTimeout(() => {
      map.flyTo(map.getCenter(), map.getZoom() + 0.35, { animate: false });
    }, 150);
  }, [geo, map]);

  return null;
};

/* -------------------------
   Focus on district
------------------------- */
const FocusOnDistrict = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;

    map.flyToBounds(bounds, {
      padding: [30, 30],
      maxZoom: 9,
      animate: true,
      duration: 0.8,
    });
  }, [bounds, map]);

  return null;
};

/* =========================
   Dashboard Component
========================= */
export default function Dashboard() {
  const [geo, setGeo] = useState(null);
  const [districtData, setDistrictData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [districtBounds, setDistrictBounds] = useState(null);

  const mapRef = useRef(null);

  const INITIAL_CENTER = [15.3173, 75.7139];
  const INITIAL_ZOOM = 6;

  /* -------------------------
      Load data
  ------------------------- */
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [gRes, mlRes] = await Promise.all([
          axios.get(GEOJSON_URL),
          axios.post("/api/ml/predict-district-wise"),
        ]);

        if (cancelled) return;

        const topo = gRes.data;
        const objectKey = Object.keys(topo.objects)[0];
        const geoJson = topoFeature(topo, topo.objects[objectKey]);

        setGeo(geoJson);

        const predsRaw = mlRes.data?.district_predictions || {};
        const preds = Object.keys(predsRaw).reduce((acc, k) => {
          const key = canonicalName(k);
          acc[key] = predsRaw[k];
          return acc;
        }, {});
        setDistrictData(preds);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load Karnataka district map.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    return () => (cancelled = true);
  }, []);

  /* -------------------------
      Reset view (UPDATED)
  ------------------------- */
  const handleResetView = () => {
    setDistrictBounds(null);

    if (mapRef.current) {
      // 1. Close any open popups (labels)
      mapRef.current.closePopup();

      // 2. Fly back to initial view
      mapRef.current.flyTo(INITIAL_CENTER, INITIAL_ZOOM, {
        animate: true,
        duration: 0.8,
      });
    }
  };

  /* -------------------------
      Styling
  ------------------------- */
  const districtStyle = (feature) => {
    const name = feature?.properties?.district;
    const key = canonicalName(name);
    const eii = districtData[key]?.inequality_index ?? districtData[key]?.EII;

    return {
      fillColor: typeof eii === "number" ? getColor(eii) : COLORS.default,
      color: "#333", // match StateSummary border
      weight: 1, // match StateSummary weight
      fillOpacity: 0.85, // match StateSummary opacity
    };
  };

  /* =========================
      Render
  ========================= */
  return (
    <>
      <main style={{ display: "flex", gap: 22, padding: 22, height: "100vh" }}>
        {/* MAP */}
        <div style={{ flex: 2, borderRadius: 10, overflow: "hidden" }}>
          <MapContainer
            center={INITIAL_CENTER}
            zoom={INITIAL_ZOOM}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {geo && <FitToGeoJSON geo={geo} />}
            <FocusOnDistrict bounds={districtBounds} />

            {geo && (
              <GeoJSON
                data={geo}
                style={districtStyle}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.district;
                  const key = canonicalName(name);
                  const eii =
                    districtData[key]?.inequality_index ??
                    districtData[key]?.EII;

                  const popupText =
                    typeof eii === "number"
                      ? `<b>${name}</b><br/>EII: ${eii.toFixed(3)}<br/>Status: ${getLabel(eii)}`
                      : `<b>${name}</b><br/>EII: No data`;

                  layer.bindPopup(popupText);

                  layer.on({
                    click: () => setDistrictBounds(layer.getBounds()),
                  });
                }}
              />
            )}
          </MapContainer>
        </div>

        {/* SIDE PANEL */}
        <div
          style={{
            width: 340,
            background: CARD_BG,
            borderRadius: 10,
            padding: 16,
            border: `1px solid ${BORDER_GREY}`,
          }}
        >
          <div style={{ fontWeight: 800, color: GOV_NAVY, marginBottom: 10 }}>
            Legend
          </div>

          {[
            { c: "#006400", t: "Excellent (≥ 0.75)" },
            { c: "#FFD700", t: "Moderate (≥ 0.50)" },
            { c: "#FF8C00", t: "Poor (≥ 0.25)" },
            { c: "#8B0000", t: "Critical (< 0.25)" },
          ].map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 12,
                  background: l.c,
                  borderRadius: 4,
                }}
              />
              <div style={{ fontSize: 13 }}>{l.t}</div>
            </div>
          ))}

          <button
            style={{
              marginTop: 20,
              width: "100%",
              padding: 12,
              background: GOV_NAVY,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 800,
            }}
          >
            Download Report
          </button>

          <button
            onClick={handleResetView}
            style={{
              marginTop: 12,
              width: "100%",
              padding: 12,
              background: "#fff",
              color: GOV_NAVY,
              border: `2px solid ${GOV_NAVY}`,
              borderRadius: 8,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Reset View
          </button>
        </div>
      </main>

      {loading && <div style={{ position: "fixed", bottom: 20 }}>Loading…</div>}
      {error && <div style={{ position: "fixed", bottom: 20 }}>{error}</div>}
    </>
  );
}
