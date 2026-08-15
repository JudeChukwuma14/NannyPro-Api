const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const ENV = require("./env");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[DB] MongoDB connected → ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

// Handle unexpected disconnections after initial connection
mongoose.connection.on("disconnected", () => {
  console.warn("[DB] MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error(`[DB] MongoDB error: ${err.message}`);
});

module.exports = connectDB;