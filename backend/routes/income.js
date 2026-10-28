const express = require("express");
const supabase = require("../supabase");
const {
  isPositiveAmount,
  isValidDate,
  isValidId,
  isValidText
} = require("../utils/validation");

const router = express.Router();

function databaseFailure(res, error) {
  console.error("Income database operation failed:", error.message);
  return res.status(500).json({
    success: false,
    message: "Unable to complete the income operation."
  });
}

// GET /api/income
router.get("/", async (req, res) => {
  try {
    let query = supabase
      .from("income")
      .select("*")
      .order("income_date", { ascending: false });

    if (req.query.from) {
      if (!isValidDate(req.query.from)) {
        return res.status(400).json({
          success: false,
          message: "Invalid start date."
        });
      }
      query = query.gte("income_date", req.query.from);
    }

    if (req.query.to) {
      if (!isValidDate(req.query.to)) {
        return res.status(400).json({
          success: false,
          message: "Invalid end date."
        });
      }
      query = query.lte("income_date", req.query.to);
    }

    const { data, error } = await query;

    if (error) return databaseFailure(res, error);

    res.json({ success: true, data });
  } catch (error) {
    return databaseFailure(res, error);
  }
});

// POST /api/income
router.post("/", async (req, res) => {
  const { amount, source, income_date } = req.body;

  if (
    !isPositiveAmount(amount) ||
    !isValidText(source, 200) ||
    !isValidDate(income_date)
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid amount, income source, and date."
    });
  }

  const { data, error } = await supabase
    .from("income")
    .insert({
      amount: Number(amount),
      source: source.trim(),
      income_date
    })
    .select()
    .single();

  if (error) return databaseFailure(res, error);

  res.status(201).json({
    success: true,
    message: "Income added successfully.",
    data
  });
});

// PUT /api/income/:id
router.put("/:id", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid income ID."
    });
  }

  const { amount, source, income_date } = req.body;

  if (
    !isPositiveAmount(amount) ||
    !isValidText(source, 200) ||
    !isValidDate(income_date)
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid amount, source, and date."
    });
  }

  const { data, error } = await supabase
    .from("income")
    .update({
      amount: Number(amount),
      source: source.trim(),
      income_date
    })
    .eq("id", req.params.id)
    .select()
    .maybeSingle();

  if (error) return databaseFailure(res, error);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Income record not found."
    });
  }

  res.json({
    success: true,
    message: "Income updated successfully.",
    data
  });
});

// DELETE /api/income/:id
router.delete("/:id", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid income ID."
    });
  }

  const { data, error } = await supabase
    .from("income")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) return databaseFailure(res, error);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Income record not found."
    });
  }

  res.json({
    success: true,
    message: "Income deleted successfully."
  });
});

module.exports = router;