const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const util = require("util");
const multer = require("multer");
const PredictionApi = require("@azure/cognitiveservices-customvision-prediction");
const msRest = require("@azure/ms-rest-js");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Azure Custom Vision Configuration
const predictionKey = process.env.VISION_PREDICTION_KEY;
const predictionEndpoint = process.env.VISION_PREDICTION_ENDPOINT;
const publishIterationName = "CarTypeIdentifyer";
const predictorCredentials = new msRest.ApiKeyCredentials({
  inHeader: { "Prediction-key": predictionKey },
});
const predictor = new PredictionApi.PredictionAPIClient(
  predictorCredentials,
  predictionEndpoint
);

// Configure multer for file uploads
const upload = multer({
  dest: "./uploads", // Directory to temporarily store files
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

// Create the connection pool to the database
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("./DigiCertGlobalRootCA.crt.pem"),
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000,
});

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
  } else {
    console.log("Database connection established successfully.");
    connection.release();
  }
});

// Promisified query
const query = util.promisify(pool.query).bind(pool);

// Route: Get insurance quote
app.get("/api/car/:name", async (req, res) => {
  const { name } = req.params;
  try {
    const results = await query(
      `SELECT anual_cost as "Anual Premium", monthly_cost as "Monthly Premium" FROM insurance_quote WHERE name = ?;`,
      [name]
    );
    if (results.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(results[0]);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving insurance quote", error });
  }
});

// Route: Predict Image Category
app.post("/api/predict", upload.single("image"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "Image file is required" });
  }

  try {
    const imagePath = file.path;

    const imageBuffer = fs.readFileSync(imagePath);

    const predictionResult = await predictor.classifyImage(
      process.env.VISION_PROJECT_ID,
      publishIterationName,
      imageBuffer // Pass the Buffer instead of a stream
    );

    const predictions = predictionResult.predictions.map((p) => ({
      tagName: p.tagName,
      probability: p.probability,
    }));

    // Delete the temporary file after processing
    fs.unlinkSync(imagePath);

    res.json({
      message: "Prediction successful",
      predictions,
    });
  } catch (error) {
    console.error("Prediction error:", error.message);

    // Delete the temporary file in case of error
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ message: "Error making prediction", error });
  }
});

// Set up port
const PORT = process.env.SERVER_PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
