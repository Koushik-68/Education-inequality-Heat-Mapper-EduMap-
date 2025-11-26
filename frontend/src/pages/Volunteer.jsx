// src/pages/Volunteer.jsx
import React, { useState } from "react";
import jsPDF from "jspdf";

const GOV_NAVY = "#0A3A67";

export default function Volunteer() {
  const [activeTab, setActiveTab] = useState("teach"); // 'teach' | 'donate'

  const [teachForm, setTeachForm] = useState({
    name: "",
    email: "",
    phone: "",
    state: "",
    district: "",
    school: "",
    classLevel: "",
    subject: "",
    mode: "offline",
    daysPerWeek: "2",
    startDate: "",
  });

  const [donateForm, setDonateForm] = useState({
    name: "",
    email: "",
    phone: "",
    state: "",
    district: "",
    school: "",
    donationType: "amount", // 'amount' | 'item'
    amount: "",
    itemName: "",
    quantity: "",
    unit: "kg",
  });

  const [statusMessage, setStatusMessage] = useState("");

  // ----------------- Helpers -----------------

  const handleTeachChange = (e) => {
    const { name, value } = e.target;
    setTeachForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDonateChange = (e) => {
    const { name, value } = e.target;
    setDonateForm((prev) => ({ ...prev, [name]: value }));
  };

  // Simple PDF generator for certificate
  const generateCertificatePDF = (type, payload) => {
    const doc = new jsPDF();

    // Header band
    doc.setFillColor(10, 58, 103); // GOV_NAVY
    doc.rect(0, 0, 210, 25, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("Government Volunteer Certificate", 105, 15, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("This is to certify that", 20, 40);

    doc.setFontSize(16);
    doc.text(payload.name || "Volunteer", 20, 50);

    doc.setFontSize(12);

    if (type === "teach") {
      doc.text(
        "has registered as a teaching volunteer to support school education.",
        20,
        60
      );
      if (payload.school) {
        doc.text(`School: ${payload.school}`, 20, 72);
      }
      if (payload.district || payload.state) {
        doc.text(
          `Location: ${payload.district || ""}, ${payload.state || ""}`,
          20,
          82
        );
      }
      if (payload.subject || payload.classLevel) {
        doc.text(
          `Teaching: Class ${payload.classLevel || "-"} • Subject: ${
            payload.subject || "-"
          }`,
          20,
          92
        );
      }
    } else if (type === "donate") {
      doc.text(
        "has contributed as a donor towards school development.",
        20,
        60
      );
      if (payload.school) {
        doc.text(`School: ${payload.school}`, 20, 72);
      }
      if (payload.district || payload.state) {
        doc.text(
          `Location: ${payload.district || ""}, ${payload.state || ""}`,
          20,
          82
        );
      }

      if (payload.donationType === "amount" && payload.amount) {
        doc.text(`Donation Type: Amount`, 20, 94);
        doc.text(`Amount: ₹ ${payload.amount}`, 20, 104);
      } else if (payload.donationType === "item") {
        doc.text(`Donation Type: In-kind items`, 20, 94);
        doc.text(
          `Item: ${payload.itemName || "-"} • Qty: ${payload.quantity || "-"} ${
            payload.unit || ""
          }`,
          20,
          104
        );
      }
    }

    doc.text(
      "We thank you for your valuable support towards improving education.",
      20,
      120
    );

    doc.setFontSize(11);
    doc.text("Date: ____________________", 20, 140);
    doc.text("Signature: ____________________", 120, 140);

    doc.save(
      type === "teach"
        ? "Teaching_Volunteer_Certificate.pdf"
        : "Donation_Certificate.pdf"
    );
  };

  // ----------------- Submit Handlers -----------------

  const handleTeachSubmit = (e) => {
    e.preventDefault();
    setStatusMessage("");

    // Simple required validation
    if (!teachForm.name || !teachForm.state || !teachForm.district) {
      setStatusMessage("Please fill at least Name, State and District.");
      return;
    }

    // Here you can call your backend API, e.g.:
    // await axios.post("/api/volunteer/teach", teachForm);

    generateCertificatePDF("teach", teachForm);
    setStatusMessage(
      "Teaching registration submitted and certificate generated."
    );
  };

  const handleDonateSubmit = (e) => {
    e.preventDefault();
    setStatusMessage("");

    if (!donateForm.name || !donateForm.state || !donateForm.district) {
      setStatusMessage("Please fill at least Name, State and District.");
      return;
    }

    if (donateForm.donationType === "amount" && !donateForm.amount) {
      setStatusMessage("Please enter donation amount.");
      return;
    }

    if (donateForm.donationType === "item" && !donateForm.itemName) {
      setStatusMessage("Please enter item name for donation.");
      return;
    }

    // API call goes here:
    // await axios.post("/api/volunteer/donate", donateForm);

    generateCertificatePDF("donate", donateForm);
    setStatusMessage("Donation details submitted and certificate generated.");
  };

  // ----------------- UI -----------------

  return (
    <div className="w-full h-full p-6 bg-white text-slate-900">
      {/* Title */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#06203a]">
          Volunteer – Support Education
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Citizens, NGOs and organisations can volunteer to teach or donate
          resources to schools.
        </p>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("teach")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border ${
            activeTab === "teach"
              ? "bg-[#06203a] text-white border-[#06203a]"
              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
          }`}
        >
          Teach
        </button>
        <button
          onClick={() => setActiveTab("donate")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border ${
            activeTab === "donate"
              ? "bg-[#06203a] text-white border-[#06203a]"
              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
          }`}
        >
          Donate
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Form */}
        <div className="border border-slate-200 rounded-md bg-slate-50 p-4">
          {activeTab === "teach" ? (
            <>
              <h2 className="text-lg font-semibold text-[#06203a] mb-3">
                Register to Teach
              </h2>
              <p className="text-xs text-slate-600 mb-4">
                Share your details to volunteer as a teacher. You may be mapped
                to a nearby government school based on availability.
              </p>

              <form onSubmit={handleTeachSubmit} className="space-y-3 text-sm">
                {/* Name / Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={teachForm.name}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-700">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={teachForm.email}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={teachForm.phone}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                </div>

                {/* State / District */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">State *</label>
                    <input
                      type="text"
                      name="state"
                      value={teachForm.state}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-700">
                      District *
                    </label>
                    <input
                      type="text"
                      name="district"
                      value={teachForm.district}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block mb-1 text-slate-700">
                    Preferred School (if known)
                  </label>
                  <input
                    type="text"
                    name="school"
                    value={teachForm.school}
                    onChange={handleTeachChange}
                    className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    placeholder="e.g. Govt Higher Primary School, XYZ"
                  />
                </div>

                {/* Class / Subject */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">
                      Class Level
                    </label>
                    <select
                      name="classLevel"
                      value={teachForm.classLevel}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    >
                      <option value="">Select</option>
                      <option value="1-5">Primary (1–5)</option>
                      <option value="6-8">Upper Primary (6–8)</option>
                      <option value="9-10">High School (9–10)</option>
                      <option value="11-12">
                        PU / Higher Secondary (11–12)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-700">Subject</label>
                    <input
                      type="text"
                      name="subject"
                      value={teachForm.subject}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                      placeholder="e.g. Maths, Science, English"
                    />
                  </div>
                </div>

                {/* Mode / Days / Start */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">
                      Mode of Teaching
                    </label>
                    <select
                      name="mode"
                      value={teachForm.mode}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    >
                      <option value="offline">Offline (in-person)</option>
                      <option value="online">Online</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-700">
                      Days per week
                    </label>
                    <select
                      name="daysPerWeek"
                      value={teachForm.daysPerWeek}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    >
                      <option value="1">1 day</option>
                      <option value="2">2 days</option>
                      <option value="3">3 days</option>
                      <option value="4">4 days</option>
                      <option value="5">5 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={teachForm.startDate}
                      onChange={handleTeachChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="bg-[#06203a] text-white px-4 py-2 rounded-md text-sm hover:bg-[#0b2f4f]"
                  >
                    Submit & Generate Certificate
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[#06203a] mb-3">
                Donate to Schools
              </h2>
              <p className="text-xs text-slate-600 mb-4">
                You can donate materials (books, stationery, food) or contribute
                funds for improving schools.
              </p>

              <form onSubmit={handleDonateSubmit} className="space-y-3 text-sm">
                {/* Name / Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={donateForm.name}
                      onChange={handleDonateChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-700">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={donateForm.email}
                      onChange={handleDonateChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={donateForm.phone}
                      onChange={handleDonateChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                </div>

                {/* State / District */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-700">State *</label>
                    <input
                      type="text"
                      name="state"
                      value={donateForm.state}
                      onChange={handleDonateChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-700">
                      District *
                    </label>
                    <input
                      type="text"
                      name="district"
                      value={donateForm.district}
                      onChange={handleDonateChange}
                      className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    />
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block mb-1 text-slate-700">
                    Target School (if known)
                  </label>
                  <input
                    type="text"
                    name="school"
                    value={donateForm.school}
                    onChange={handleDonateChange}
                    className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                    placeholder="e.g. Govt High School, ABC"
                  />
                </div>

                {/* Donation Type */}
                <div>
                  <label className="block mb-1 text-slate-700">
                    Donation Type
                  </label>
                  <div className="flex gap-6 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="donationType"
                        value="amount"
                        checked={donateForm.donationType === "amount"}
                        onChange={handleDonateChange}
                      />
                      <span>Amount</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="donationType"
                        value="item"
                        checked={donateForm.donationType === "item"}
                        onChange={handleDonateChange}
                      />
                      <span>Items (books, rice, stationery, etc.)</span>
                    </label>
                  </div>
                </div>

                {/* Amount or Item Fields */}
                {donateForm.donationType === "amount" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-slate-700">
                        Amount (₹) *
                      </label>
                      <input
                        type="number"
                        name="amount"
                        value={donateForm.amount}
                        onChange={handleDonateChange}
                        className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block mb-1 text-slate-700">
                        Item Name *
                      </label>
                      <input
                        type="text"
                        name="itemName"
                        value={donateForm.itemName}
                        onChange={handleDonateChange}
                        className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                        placeholder="e.g. Notebooks, Rice, Pens"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-700">
                        Quantity
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          name="quantity"
                          value={donateForm.quantity}
                          onChange={handleDonateChange}
                          className="border border-slate-300 rounded-md px-2 py-1.5 w-full"
                        />
                        <select
                          name="unit"
                          value={donateForm.unit}
                          onChange={handleDonateChange}
                          className="border border-slate-300 rounded-md px-2 py-1.5"
                        >
                          <option value="kg">kg</option>
                          <option value="bags">bags</option>
                          <option value="sets">sets</option>
                          <option value="pieces">pieces</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    className="bg-[#06203a] text-white px-4 py-2 rounded-md text-sm hover:bg-[#0b2f4f]"
                  >
                    Submit & Generate Certificate
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Right side: Info / Guidelines */}
        <div className="border border-slate-200 rounded-md bg-white p-4 text-sm">
          <h3 className="text-base font-semibold text-[#06203a] mb-3">
            How this Volunteer module works
          </h3>

          <ol className="list-decimal list-inside space-y-2 text-slate-700 mb-4">
            <li>
              Select <b>Teach</b> or <b>Donate</b> at the top.
            </li>
            <li>Fill basic details like name, location and school.</li>
            <li>
              On submit, details can be stored in your backend (API integration)
              and a PDF certificate is generated.
            </li>
            <li>
              This certificate can be used as acknowledgement for volunteers /
              donors.
            </li>
          </ol>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50 mb-3">
            <div className="font-semibold text-[#06203a] mb-1">
              Backend Integration (Next Step)
            </div>
            <p className="text-slate-700 text-xs">
              Connect this page to APIs like:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 mt-1">
              <li>
                <code>/api/volunteer/teach</code> – save teaching volunteers
              </li>
              <li>
                <code>/api/volunteer/donate</code> – save donation records
              </li>
            </ul>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50">
            <div className="font-semibold text-[#06203a] mb-1">
              Privacy & Trust
            </div>
            <p className="text-xs text-slate-700">
              Only collect required information. Show a simple disclaimer about
              data usage and follow basic privacy guidelines for a public
              government-style portal.
            </p>
          </div>

          {statusMessage && (
            <div className="mt-4 text-sm font-medium text-emerald-700">
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
