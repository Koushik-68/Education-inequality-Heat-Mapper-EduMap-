import {
  FaHome,
  FaMapMarkedAlt,
  FaChartBar,
  FaRegListAlt,
  FaUpload,
  FaFileDownload,
} from "react-icons/fa";

export default function Sidebar({ active = "Dashboard" }) {
  return (
    <aside className="bg-white border-r border-slate-200 text-slate-900 w-72 min-h-screen flex flex-col py-6 px-4 shadow-none">
      {/* Government emblem + Title */}
      <div className="mb-6 flex items-center gap-3 px-1">
        {/* emblem circle */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(180deg,#06203a,#0b2b46)" }}
          aria-hidden="true"
        >
          {/* simple, stylized emblem: laurel + wheel */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="white"
              strokeWidth="0.8"
              fill="none"
            />
            <path
              d="M12 6v12"
              stroke="white"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <path
              d="M6 12h12"
              stroke="white"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="2.2" fill="white" />
          </svg>
        </div>

        <div>
          <span className="font-semibold text-base text-[#06203a] tracking-wide">
            Government Portal
          </span>
          <p className="text-[11px] text-slate-500">
            Citizen Dashboard — Public View
          </p>
        </div>
      </div>

      {/* thin saffron accent bar */}
      <div
        className="h-[4px] w-full rounded-md mb-4"
        style={{
          background: "linear-gradient(90deg,#ff9933,#ffffff 50%,#128807)",
        }}
      />

      <nav className="flex flex-col gap-2" aria-label="Main navigation">
        <SidebarButton
          label="Dashboard"
          active={active === "Dashboard"}
          href="/public"
          icon={<FaHome className="w-5 h-5" />}
        />

        <FeatureRow
          label="Map View"
          icon={<FaMapMarkedAlt className="w-5 h-5" />}
        />
        <FeatureRow
          label="State Summary"
          icon={<FaChartBar className="w-5 h-5" />}
        />
        <FeatureRow
          label="District Details"
          icon={<FaRegListAlt className="w-5 h-5" />}
        />
        <FeatureRow
          label="Data Upload"
          icon={<FaUpload className="w-5 h-5" />}
        />
        <FeatureRow
          label="Reports"
          icon={<FaFileDownload className="w-5 h-5" />}
        />
      </nav>

      <div className="mt-auto pt-6 px-1 text-[12px] text-slate-600 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500">Access</div>
            <div className="text-sm font-medium text-[#06203a]">
              Citizen • Read-only
            </div>
          </div>
          <div className="text-xs text-slate-400">v1.0</div>
        </div>
      </div>
    </aside>
  );
}

function SidebarButton({ label, active, href, icon }) {
  return (
    <a
      href={href}
      className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150
      ${
        active
          ? "bg-[#06203a] text-white shadow-sm"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex items-center gap-3">
        <span className={`${active ? "text-white" : "text-slate-500"}`}>
          {icon}
        </span>
        {label}
      </span>

      {active && (
        <span className="text-[10px] uppercase tracking-wider text-slate-200">
          Active
        </span>
      )}
    </a>
  );
}

function FeatureRow({ label, icon }) {
  // Non-clickable row, kept visually consistent
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-100`}
      role="button"
      aria-label={label}
      tabIndex={0}
      onKeyDown={() => {}}
    >
      <span className="flex items-center gap-3">
        <span className="text-slate-500">{icon}</span>
        {label}
      </span>
      <span className="text-[11px] text-slate-400">View</span>
    </div>
  );
}
