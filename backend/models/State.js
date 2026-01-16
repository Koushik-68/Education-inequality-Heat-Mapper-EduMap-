const mongoose = require("mongoose");

const DistrictSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const StateSchema = new mongoose.Schema(
  {
    code: { type: String, index: true },
    name: { type: String },
    score: { type: Number, default: 0 },
    literacy_pct: { type: Number },
    enrolment_pct: { type: Number },
    infra_index_pct: { type: Number },
    districts: { type: [DistrictSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("State", StateSchema);
