import React from "react";

// Replacing react-icons/fa with inline Lucide SVGs (a modern, high-quality icon set)
// These icons mimic the functionality of the previously imported Fa icons.

const IconHome = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-home"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconBarChart = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-bar-chart"
  >
    <line x1="12" x2="12" y1="20" y2="10" />
    <line x1="18" x2="18" y1="20" y2="4" />
    <line x1="6" x2="6" y1="20" y2="16" />
  </svg>
);
const IconMap = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-map"
  >
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" x2="9" y1="3" y2="18" />
    <line x1="15" x2="15" y1="6" y2="21" />
  </svg>
);
const IconList = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-list-todo"
  >
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17h18" />
    <path d="m3 11h18" />
    <path d="m13 5h8" />
  </svg>
);
const IconUpload = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-upload"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);
const IconDownload = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-download"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

// --- Components combined into a single file ---

function SidebarButton({ label, active, href, icon }) {
  const baseClasses =
    "flex items-center justify-between px-5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-in-out cursor-pointer";

  return (
    <a
      href={href}
      className={`${baseClasses} 
      ${
        active
          ? "bg-[#06203a] text-white shadow-2xl shadow-[#06203a]/40 transform scale-[1.02] ring-2 ring-[#ff9933]/50" // Richer active style
          : "text-slate-700 hover:bg-slate-100/70 hover:text-[#06203a] hover:shadow-inner" // Subtle inactive hover
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex items-center gap-3">
        {/* Icon color inversion for better contrast, passing size class */}
        <span className={`w-5 h-5 ${active ? "text-white" : "text-slate-500"}`}>
          {/* We must clone the element to pass the class names down */}
          {React.cloneElement(icon, { className: "w-5 h-5" })}
        </span>
        {label}
      </span>

      {active && (
        <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#ff9933]">
          LIVE
        </span>
      )}
    </a>
  );
}

function FeatureRow({ label, icon }) {
  // Non-clickable row with a "View" placeholder text
  return (
    <div
      className={`flex items-center justify-between px-5 py-3.5 rounded-xl text-sm font-semibold text-slate-700 transition-all duration-300 ease-in-out cursor-pointer hover:bg-slate-100/70 hover:text-[#06203a]`}
      role="button"
      aria-label={label}
      tabIndex={0}
      onKeyDown={() => {}}
    >
      <span className="flex items-center gap-3">
        <span className="text-slate-500 w-5 h-5">
          {/* We must clone the element to pass the class names down */}
          {React.cloneElement(icon, { className: "w-5 h-5" })}
        </span>
        {label}
      </span>
      {/* Subtle, refined secondary action text */}
      <span className="text-[11px] text-slate-400 font-normal">Details</span>
    </div>
  );
}

export default function Sidebar({ active = "Dashboard" }) {
  return (
    // Updated background to soft grey with subtle shadow
    <aside className="bg-gray-50 border-r border-slate-200 text-slate-900 w-72 min-h-screen flex flex-col py-8 px-5 shadow-2xl shadow-slate-300/50">
      {/* Government emblem + Title */}
      <div className="mb-8 flex items-center gap-4 px-1 pb-4 border-b border-slate-100">
        {/* Emblem circle with richer gradient */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center p-1"
          style={{
            background: "linear-gradient(135deg, #0b2b46, #06203a)",
            boxShadow: "0 4px 15px rgba(6, 32, 58, 0.4)",
          }}
          aria-hidden="true"
        >
          {/* simple, stylized emblem: refined SVG */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white"
          >
            {/* Outer Circle (more stylized) */}
            <path
              d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM12 4v16M4 12h16"
              stroke="white"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3.5" fill="#ff9933" />{" "}
            {/* Saffron center accent */}
          </svg>
        </div>

        <div>
          <span className="font-extrabold text-lg text-[#06203a] tracking-tight leading-snug">
            GOV • PORTAL
          </span>
          <p className="text-[12px] text-slate-500 mt-0.5">Public Data View</p>
        </div>
      </div>

      {/* thicker saffron accent bar */}
      <div
        className="h-[6px] w-full rounded-full mb-6 shadow-md"
        style={{
          background:
            "linear-gradient(90deg,#ff9933 30%,#ffffff 50%,#128807 70%)",
        }}
      />

      <nav className="flex flex-col gap-3" aria-label="Main navigation">
        <SidebarButton
          label="Dashboard"
          active={active === "Dashboard"}
          href="/dashboard"
          icon={<IconHome />}
        />
        {/* New item for Map/GIS data */}
        <SidebarButton
          label="State Summary"
          active={active === "StateSummary"}
          href="/state-summary"
          icon={<IconMap />}
        />
        <SidebarButton
          label="Data Upload"
          active={active === "DataUpload"}
          href="/data-upload"
          icon={<IconUpload />}
        />

        {/* Feature Rows (non-clickable) */}
        {/* <FeatureRow label="District Details" icon={<IconList />} />

        <SidebarButton
          label="Data Upload"
          active={active === "DataUpload"}
          href="#data-upload"
          icon={<IconUpload />} */}
        {/* />

        <FeatureRow label="Reports Download" icon={<IconDownload />} /> */}
      </nav>

      {/* Footer / Status Area */}
      <div className="mt-auto pt-6 px-1 text-[12px] text-slate-600 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">
              Current Access Level
            </div>
            <div className="text-base font-extrabold text-[#06203a] leading-tight mt-0.5">
              Citizen • Read-Only
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono italic">v2.1.0</div>
        </div>
      </div>
    </aside>
  );
}
