
require("dotenv").config();

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const supabase = require("./supabase");

const expensesRoutes = require("./routes/expenses");
const incomeRoutes = require("./routes/income");
const budgetsRoutes = require("./routes/budgets");
const categoriesRoutes = require("./routes/categories");
const reportsRoutes = require("./routes/reports");

const {
  notFound,
  errorHandler
} = require("./middleware/errorHandler");

const app = express();
const PORT = Number(process.env.PORT) || 300;

// Security settings
app.disable("x-powered-by");

// Helmet security headers.
// This policy permits the inline styles and Google Fonts used by
// some frontend templates. Keep the policy as restrictive as possible
// for your actual application.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"]
      }
    }
  })
);

app.use(express.json({ limit: "20kb" }));

// Rate limiting for API requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

// API health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Personal Expense Tracker API is running."
  });
});

// Database connectivity check
app.get("/api/health/database", async (req, res) => {
  try {
    const { error } = await supabase
      .from("categories")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Database health check failed:", error.message);

      return res.status(503).json({
        success: false,
        message: "Database connection check failed."
      });
    }

    return res.json({
      success: true,
      message: "Database connection successful."
    });
  } catch (error) {
    console.error("Database health check error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database is currently unavailable."
    });
  }
});

// Register API routes
app.use("/api/expenses", expensesRoutes);
app.use("/api/income", incomeRoutes);
app.use("/api/budgets", budgetsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/reports", reportsRoutes);

// Frontend directory
const frontendPath = path.join(__dirname, "..", "frontend");

// Serve CSS, JavaScript, images, and other static files
app.use(
  express.static(frontendPath, {
    index: false
  })
);

// Serve the main HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"), (error) => {
    if (error && !res.headersSent) {
      console.error("Could not serve index.html:", error.message);

      res.status(500).send(
        "Could not load the frontend. Check that frontend/index.html exists."
      );
    }
  });
});

// Handle unknown routes and errors
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log("-------------------------------------------");
  console.log("Personal Expense Tracker is running!");
  console.log(`Website: http://localhost:${PORT}`);
  console.log(`API health: http://localhost:${PORT}/api/health`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("-------------------------------------------");
});
