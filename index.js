const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create the connection pool to the database
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DATABASE,
  port: process.env.PORT,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("./DigiCertGlobalRootCA.crt.pem"),
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000, // Optional: Set a higher timeout
});

// Default route handler
app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/insurance", (req, res) => {
  console.log("GET /insurance endpoint was hit 🎯");
  pool.query("SELECT * FROM insurance_quote", (err, results) => {
    if (err) {
      console.error("Error fetching Insurance:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.json(results);
  });
});

// set up port
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
