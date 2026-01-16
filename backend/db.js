const mongoose = require("mongoose");

const dbUrl = process.env.DB_URL;

const connectionParams = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

const connectDatabase = () => {
  if (!dbUrl) {
    console.error("DB_URL missing in environment. Set it in config.env");
    process.exit(1);
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
