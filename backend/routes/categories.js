const express = require("express");
const supabase = require("../supabase");
const { isValidText } = require("../utils/validation");

const router = express.Router();

function databaseFailure(res, error) {
  console.error("Category database operation failed:", error.message);

  return res.status(500).json({
    success: false,
    message: "Unable to complete the category operation."
  });
}

// GET /api/categories
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) return databaseFailure(res, error);

  res.json({ success: true, data });
});

// POST /api/categories
router.post("/", async (req, res) => {
  const { name, type } = req.body;

  if (!isValidText(name, 50) || !["expense", "income"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid category name and type."
    });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: name.trim(),
      type
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A category with that name and type already exists."
      });
    }

    return databaseFailure(res, error);
  }

  res.status(201).json({
    success: true,
    message: "Category created successfully.",
    data
  });
});

module.exports = router;