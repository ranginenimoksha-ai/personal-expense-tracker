const express = require("express");
const supabase = require("../supabase");
const {
  isPositiveAmount,
  isValidDate,
  isValidId,
  isValidText
} = require("../utils/validation");

const router = express.Router();

function handleDatabaseError(res, error) {
  console.error("Expense database operation failed:", error.message);
  return res.status(500).json({
    success: false,
    message: "Unable to complete the expense operation."
  });
}

// GET /api/expenses
router.get("/", async (req, res) => {
  try {
    const { from, to, category_id } = req.query;

    let query = supabase
      .from("expenses")
      .select("id, amount, description, category_id, expense_date, created_at")
      .order("expense_date", { ascending: false });

    if (from) {
      if (!isValidDate(from)) {
        return res.status(400).json({
          success: false,
          message: "Invalid start date."
        });
      }
      query = query.gte("expense_date", from);
    }

    if (to) {
      if (!isValidDate(to)) {
        return res.status(400).json({
          success: false,
          message: "Invalid end date."
        });
      }
      query = query.lte("expense_date", to);
    }

    if (category_id) {
      if (!isValidId(category_id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID."
        });
      }
      query = query.eq("category_id", category_id);
    }

    const { data, error } = await query;

    if (error) return handleDatabaseError(res, error);

    res.json({ success: true, data });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
});

// GET /api/expenses/:id
router.get("/:id", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid expense ID."
    });
  }

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (error) return handleDatabaseError(res, error);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Expense not found."
    });
  }

  res.json({ success: true, data });
});

// POST /api/expenses
router.post("/", async (req, res) => {
  const { amount, description, category_id, expense_date } = req.body;

  if (!isPositiveAmount(amount)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid positive expense amount."
    });
  }

  if (!isValidText(description, 200)) {
    return res.status(400).json({
      success: false,
      message: "Description is required and must be at most 200 characters."
    });
  }

  if (!isValidId(category_id) || !isValidDate(expense_date)) {
    return res.status(400).json({
      success: false,
      message: "A valid category and expense date are required."
    });
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      amount: Number(amount),
      description: description.trim(),
      category_id,
      expense_date
    })
    .select()
    .single();

  if (error) return handleDatabaseError(res, error);

  res.status(201).json({
    success: true,
    message: "Expense added successfully.",
    data
  });
});

// PUT /api/expenses/:id
router.put("/:id", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid expense ID."
    });
  }

  const { amount, description, category_id, expense_date } = req.body;

  if (
    !isPositiveAmount(amount) ||
    !isValidText(description, 200) ||
    !isValidId(category_id) ||
    !isValidDate(expense_date)
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid amount, description, category, and date."
    });
  }

  const { data, error } = await supabase
    .from("expenses")
    .update({
      amount: Number(amount),
      description: description.trim(),
      category_id,
      expense_date
    })
    .eq("id", req.params.id)
    .select()
    .maybeSingle();

  if (error) return handleDatabaseError(res, error);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Expense not found."
    });
  }

  res.json({
    success: true,
    message: "Expense updated successfully.",
    data
  });
});

// DELETE /api/expenses/:id
router.delete("/:id", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid expense ID."
    });
  }

  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) return handleDatabaseError(res, error);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Expense not found."
    });
  }

  res.json({
    success: true,
    message: "Expense deleted successfully."
  });
});

module.exports = router;