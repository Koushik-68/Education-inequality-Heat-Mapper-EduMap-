import Dashboard from "./pages/Dashboard.jsx";
import StateSummary from "./pages/StateSummary.jsx";
import Sidebar from "./component/Sidebar.jsx";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

function Layout({ children }) {
  const location = useLocation();
  // Determine active sidebar item
  let active = "Dashboard";
  if (location.pathname.startsWith("/state-summary")) active = "StateSummary";
  // Uniform header style
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
    <div style={{ minHeight: "100vh", background: "#f6fafc" }}>
      <header
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          borderBottom: "3px solid #0B3D91",
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
              background: "#0B3D91",
              boxShadow: "0 6px 18px rgba(11,61,145,0.12)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#fff" />
              <circle cx="12" cy="12" r="6" fill="#0B3D91" />
            </svg>
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0B3D91" }}>
              EDUCATIONAL INEQUALITY HEAT MAPPER
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Government of India • Public dashboard
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            style={{
              background: "#0B3D91",
              color: "#fff",
              padding: "10px 16px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: "0 8px 30px rgba(11,61,145,0.08)",
            }}
          >
            Download Report
          </button>
          <button
            style={{
              background: "transparent",
              color: "#263244",
              padding: "8px 12px",
              border: "1px solid #e6eef8",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Help
          </button>
        </div>
      </header>
      <div style={containerStyle}>
        <div
          style={{
            width: SIDEBAR_WIDTH,
            height: "100%",
            flexShrink: 0,
            padding: 18,
          }}
        >
          <Sidebar active={active} />
        </div>
        <main
          style={{
            flexGrow: 1,
            minWidth: 0,
            height: "100%",
            overflowY: "auto",
            padding: "0",
            boxSizing: "border-box",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/state-summary" element={<StateSummary />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
