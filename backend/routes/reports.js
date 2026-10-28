const express = require("express");
const supabase = require("../supabase");
const { isValidMonth } = require("../utils/validation");

const router = express.Router();

router.get("/monthly", async (req, res) => {
  const month = req.query.month;

  if (!isValidMonth(month)) {
    return res.status(400).json({
      success: false,
      message: "Provide a month in YYYY-MM format."
    });
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 10);

  try {
    const [
      expenseResult,
      incomeResult,
      categoryResult,
      budgetResult
    ] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount, category_id")
        .gte("expense_date", startDate)
        .lt("expense_date", endDate),

      supabase
        .from("income")
        .select("amount")
        .gte("income_date", startDate)
        .lt("income_date", endDate),

      supabase.from("categories").select("id, name"),

      supabase
        .from("budgets")
        .select("amount")
        .eq("month", startDate)
    ]);

    const results = [
      expenseResult,
      incomeResult,
      categoryResult,
      budgetResult
    ];

    const failed = results.find((result) => result.error);

    if (failed) {
      console.error("Report database operation failed:", failed.error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to generate the monthly report."
      });
    }

    const expenses = expenseResult.data;
    const income = incomeResult.data;
    const categories = categoryResult.data;
    const budgets = budgetResult.data;

    const totalExpenses = expenses.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );

    const totalIncome = income.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );

    const categoryTotals = {};

    for (const expense of expenses) {
      categoryTotals[expense.category_id] =
        (categoryTotals[expense.category_id] || 0) +
        Number(expense.amount);
    }

    const categoryBreakdown = categories
      .map((category) => ({
        category_id: category.id,
        category: category.name,
        total: Number(categoryTotals[category.id] || 0)
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    const totalBudget = budgets.reduce(
      (sum, budget) => sum + Number(budget.amount),
      0
    );

    res.json({
      success: true,
      data: {
        month,
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        totalBudget,
        budgetRemaining: totalBudget - totalExpenses,
        categoryBreakdown
      }
    });
  } catch (error) {
    console.error("Report generation failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to generate the monthly report."
    });
  }
});

module.exports = router;