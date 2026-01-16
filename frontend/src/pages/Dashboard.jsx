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
const DATA_URL = "/data/data.json";

const GOV_NAVY = "#0B3D91";
const DARK_GREY = "#263244";
const BORDER_GREY = "#e6eef8";
const CARD_BG = "rgba(255,255,255,0.96)";

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
        const [gRes, dRes] = await Promise.all([
          axios.get(GEOJSON_URL),
          axios.get(DATA_URL),
        ]);

        if (cancelled) return;

        const topo = gRes.data;
        const objectKey = Object.keys(topo.objects)[0];
        const geoJson = topoFeature(topo, topo.objects[objectKey]);

        setGeo(geoJson);
        setDistrictData(dRes.data?.districts || {});
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
    const score = districtData[name]?.score ?? -1;

    return {
      fillColor: getColorForScore(score),
      color: "#cbd5e1",
      weight: 1,
      fillOpacity: 0.95,
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
                  const score = districtData[name]?.score ?? "No data";

                  layer.bindPopup(
                    `<b>${name}</b><br/>Inequality Score: ${score}`
                  );

                  layer.on({
                    click: () => setDistrictBounds(layer.getBounds()),
                    mouseover: (e) =>
                      e.target.setStyle({ weight: 2, color: GOV_NAVY }),
                    mouseout: (e) => e.target.setStyle(districtStyle(feature)),
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
            { c: COLORS.low, t: "Low inequality (Score 0)" },
            { c: COLORS.medium, t: "Medium inequality (Score 1)" },
            { c: COLORS.high, t: "High inequality (Score 2)" },
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
