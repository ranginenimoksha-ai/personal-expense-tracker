const express = require("express");
const supabase = require("../supabase");
const {
  isPositiveAmount,
  isValidId,
  isValidMonth
} = require("../utils/validation");

const router = express.Router();

function databaseFailure(res, error) {
  console.error("Budget database operation failed:", error.message);

  return res.status(500).json({
    success: false,
    message: "Unable to complete the budget operation."
  });
}

// GET /api/budgets?month=2026-10
router.get("/", async (req, res) => {
  const month = req.query.month;

  if (!isValidMonth(month)) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid month in YYYY-MM format."
    });
  }

  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("month", monthStart)
    .order("created_at", { ascending: false });

  if (error) return databaseFailure(res, error);

  // Calculate spending for the selected month.
  const { data: expenses, error: expenseError } = await supabase
    .from("expenses")
    .select("category_id, amount")
    .gte("expense_date", monthStart)
    .lt("expense_date", nextMonth);

  if (expenseError) return databaseFailure(res, expenseError);

  const spentByCategory = {};

  for (const expense of expenses) {
    spentByCategory[expense.category_id] =
      (spentByCategory[expense.category_id] || 0) +
      Number(expense.amount);
  }

  const results = data.map((budget) => ({
    ...budget,
    spent: Number(spentByCategory[budget.category_id] || 0),
    remaining:
      Number(budget.amount) -
      Number(spentByCategory[budget.category_id] || 0)
  }));

  res.json({ success: true, data: results });
});

// POST /api/budgets
// Creates a budget or updates the budget for that category and month.
router.post("/", async (req, res) => {
  const { category_id, month, amount } = req.body;

  if (
    !isValidId(category_id) ||
    !isValidMonth(month) ||
    !isPositiveAmount(amount)
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid category, month, and budget amount."
    });
  }

  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      {
        category_id,
        month: `${month}-01`,
        amount: Number(amount)
      },
      { onConflict: "category_id,month" }
    )
    .select()
    .single();

  if (error) return databaseFailure(res, error);

  res.status(200).json({
    success: true,
    message: "Monthly budget saved successfully.",
    data
  });
});

// DELETE /api/budgets/:id
router.delete("/:id", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid budget ID."
    });
  }

  const { data, error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) return databaseFailure(res, error);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Budget not found."
    });
  }

  res.json({
    success: true,
    message: "Budget deleted successfully."
  });
});

module.exports = router;