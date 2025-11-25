import React, { useState, useCallback, useMemo } from "react";
import axios from "axios";

// -----------------------------------------------------------------------------
// INLINE SVG ICONS (Replaced lucide-react to fix module resolution error)
// -----------------------------------------------------------------------------

const IconUploadCloud = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 14.5V14a2 2 0 0 1 2-2h4.155a4 4 0 0 1 3.565 1.637l.74 1.103a4 4 0 0 0 3.565 1.637H18a2 2 0 0 0 2-2v-1.5"></path>
    <path d="M12 18V6"></path>
    <path d="m15 9-3-3-3 3"></path>
  </svg>
);

const IconFileText = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
    <path d="M10 9H8"></path>
    <path d="M16 13H8"></path>
    <path d="M16 17H8"></path>
  </svg>
);

const IconAlertTriangle = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m21.73 18-9-15.58L3.27 18Z"></path>
    <path d="M12 9v4"></path>
    <path d="M12 17h.01"></path>
  </svg>
);

const IconCheckCircle = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <path d="m9 11 3 3L22 4"></path>
  </svg>
);

const IconClock = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

// Main App Component
const App = () => {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState("");
  const [preview, setPreview] = useState(null);
  const [localPath, setLocalPath] = useState("");
  const [status, setStatus] = useState({
    type: "info",
    message: "Ready to upload data.",
  });
  const [isDragging, setIsDragging] = useState(false);

  // Constants for styling
  const primaryColor = "text-indigo-600";
  const primaryBg = "bg-indigo-600 hover:bg-indigo-700";
  const accentColor = "bg-emerald-500 hover:bg-emerald-600";

  // Helper function to handle file processing and preview generation
  const processFile = useCallback((selectedFile) => {
    setFile(selectedFile);
    setStatus({ type: "info", message: `File selected: ${selectedFile.name}` });
    setPreview(null); // Clear old preview

    const reader = new FileReader();

    const isCsv =
      selectedFile.name.endsWith(".csv") || selectedFile.type.includes("csv");
    const isJson =
      selectedFile.name.endsWith(".geojson") ||
      selectedFile.name.endsWith(".json") ||
      selectedFile.name.endsWith(".topojson") ||
      selectedFile.type.includes("json");

    if (isCsv) {
      reader.onload = (event) => {
        const content = event.target.result.split("\n").slice(0, 10).join("\n");
        setPreview(content);
      };
      reader.readAsText(selectedFile);
      setFileType("csv");
    } else if (isJson) {
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          // Prettify and truncate the JSON preview
          const content = JSON.stringify(json, null, 2);
          setPreview(
            content.slice(0, 3000) +
              (content.length > 3000 ? "...\n\n[Truncated for brevity]" : "")
          );
        } catch {
          setPreview("Invalid JSON format. Check syntax.");
        }
      };
      reader.readAsText(selectedFile);
      // Try to infer type
      if (selectedFile.name.endsWith(".geojson")) setFileType("geojson");
      else if (selectedFile.name.endsWith(".topojson")) setFileType("topojson");
      else setFileType("geojson"); // Default to geojson for generic json
    } else {
      setStatus({
        type: "warning",
        message: "Unsupported file type. Please select CSV or JSON format.",
      });
      setFile(null);
      setFileType("");
    }
  }, []);

  // Handler for direct input file change
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Upload Logic
  const handleUpload = async () => {
    if (!file && !localPath) {
      setStatus({
        type: "error",
        message: "❌ Please choose a file or enter a local path.",
      });
      return;
    }

    if (!fileType) {
      setStatus({
        type: "error",
        message: "❌ Please select a File Type first.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("fileType", fileType);

    if (file) formData.append("file", file);
    if (localPath) formData.append("localPath", localPath);

    try {
      setStatus({
        type: "loading",
        message: "⏳ Uploading data... Please wait.",
      });
      // Simulating network request delay as the backend endpoint is mocked
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const res = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus({
        type: "success",
        message: "✅ File uploaded successfully! Data is now processing.",
      });
      console.log("UPLOAD RESPONSE → ", res.data);
    } catch (err) {
      setStatus({
        type: "error",
        message: "❌ Upload failed. Check console for details.",
      });
      console.error(err);
    }
  };

  // Determine the status message styling and icon
  const getStatusDisplay = useMemo(() => {
    let IconComponent, styles;
    switch (status.type) {
      case "success":
        IconComponent = IconCheckCircle;
        styles = "text-emerald-700 bg-emerald-100 border-emerald-300";
        break;
      case "error":
        IconComponent = IconAlertTriangle;
        styles = "text-red-700 bg-red-100 border-red-300";
        break;
      case "loading":
        IconComponent = IconClock;
        styles = "text-indigo-700 bg-indigo-100 border-indigo-300";
        break;
      default: // info/warning
        IconComponent = IconFileText;
        styles = "text-slate-700 bg-slate-100 border-slate-300";
        break;
    }
    return { IconComponent, styles };
  }, [status.type]);

  const { IconComponent: StatusIcon, styles: statusStyles } = getStatusDisplay;

  const uploadIsDisabled = !file && !localPath;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 sm:p-8 font-inter">
      <div className="w-full max-w-4xl bg-white shadow-2xl rounded-xl p-6 sm:p-10 my-10">
        {/* HEADER */}
        <header className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
            <IconUploadCloud className={`w-8 h-8 mr-3 ${primaryColor}`} />
            Secure Data Ingestion Portal
          </h1>
          <p className="mt-2 text-gray-500">
            Upload your district-level statistical data or geographical boundary
            files (GeoJSON/TopoJSON) for processing.
          </p>
        </header>

        {/* FILE TYPE SELECTION & UPLOAD AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* 1. FILE TYPE SELECTOR */}
          <div className="lg:col-span-1">
            <label
              htmlFor="fileTypeSelect"
              className="block text-sm font-bold text-gray-700 mb-2"
            >
              1. Select Data Schema
            </label>
            <select
              id="fileTypeSelect"
              className="border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg p-3 w-full transition duration-150 ease-in-out shadow-sm bg-white text-gray-800"
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
            >
              <option value="" disabled>
                -- Choose File Type --
              </option>
              <option value="csv">📊 District/Statistical Data (CSV)</option>
              <option value="geojson">🗺️ GeoJSON Boundary File</option>
              <option value="topojson">📍 TopoJSON Boundary File</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Determines how the system interprets the file structure.
            </p>
          </div>

          {/* 2. FILE DRAG & DROP ZONE (Custom Input) */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              2. Upload or Drag File Here
            </label>
            <div
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition duration-200 
                ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("filePicker").click()}
            >
              <input
                id="filePicker"
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <>
                  <IconFileText className={`w-8 h-8 ${primaryColor}`} />
                  <p className="mt-2 text-sm font-semibold text-gray-900 truncate max-w-full">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Click to select a different file.
                  </p>
                </>
              ) : (
                <>
                  <IconUploadCloud className="w-8 h-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    Drag and drop your file here, or{" "}
                    <span
                      className={`font-semibold ${primaryColor} cursor-pointer`}
                    >
                      browse
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Max file size: 50MB. CSV, GeoJSON, TopoJSON only.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3. LOCAL PATH INPUT */}
        <div className="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center">
            <IconAlertTriangle className="w-4 h-4 mr-2" />
            OR Load From Local Path (Development/Test Mode)
          </label>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <input
              type="text"
              placeholder="E.g., C:/data/boundary-files.geojson"
              className="flex-grow border border-gray-300 rounded-lg p-3 text-sm shadow-inner focus:ring-indigo-500 focus:border-indigo-500"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
            />

            <button
              className="w-full sm:w-auto bg-yellow-100 text-yellow-800 px-4 py-3 rounded-lg text-sm font-medium hover:bg-yellow-200 transition duration-150"
              onClick={() =>
                setLocalPath("C:/Users/Admin/Downloads/india-states.geojson")
              }
            >
              Use Sample Path
            </button>
          </div>
        </div>

        {/* FILE PREVIEW */}
        {preview && (
          <div className="mt-8">
            <h3 className="font-bold text-gray-700 mb-3 border-l-4 border-indigo-500 pl-3">
              File Preview ({file?.name || localPath.split("/").pop()})
            </h3>
            <pre className="bg-gray-800 text-green-300 p-4 rounded-lg max-h-96 overflow-auto text-xs sm:text-sm font-mono shadow-inner transition duration-300 hover:shadow-md">
              {preview}
            </pre>
          </div>
        )}

        {/* UPLOAD BUTTON & STATUS */}
        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t pt-6">
          <button
            className={`w-full sm:w-auto text-white px-8 py-3 rounded-xl text-lg font-bold shadow-lg transition duration-200 
                  ${
                    uploadIsDisabled
                      ? "bg-gray-400 cursor-not-allowed"
                      : `${accentColor} transform hover:scale-[1.02] active:scale-100`
                  }`}
            onClick={handleUpload}
            disabled={uploadIsDisabled}
          >
            {uploadIsDisabled ? "Select File to Enable" : "Start Secure Upload"}
          </button>

          {/* STATUS TEXT BOX */}
          <div
            className={`mt-4 sm:mt-0 sm:ml-6 flex items-center p-3 rounded-lg border w-full sm:w-auto ${statusStyles}`}
          >
            <StatusIcon
              className={`w-5 h-5 mr-2 ${
                status.type === "loading" ? "animate-spin" : ""
              }`}
            />
            <div className="text-sm font-medium">{status.message}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
