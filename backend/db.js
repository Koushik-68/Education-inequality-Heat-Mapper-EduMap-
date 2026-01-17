const mongoose = require("mongoose");

const dbUrl = process.env.DB_URL;

const connectionParams = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

const connectDatabase = () => {
  if (!dbUrl) {
    console.warn(
      "DB_URL missing in environment. Skipping DB connection for now.",
    );
    return; // Allow server to start without DB for ML testing
  }
  mongoose
    .connect(dbUrl, connectionParams)
    .then(() => {
      console.log("Connected to the database");
    })
    .catch((error) => {
      console.error("Database connection error:", error);
      process.exit(1);
    });
};

module.exports = connectDatabase;
