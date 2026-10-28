
"use strict";

const express = require("express");
const { randomUUID } = require("node:crypto");
const supabase = require("../supabase");

const router = express.Router();

const VALID_TYPES = ["income", "expense"];

const VALID_CATEGORIES = [
    "Food",
    "Transport",
    "Education",
    "Shopping",
    "Bills",
    "Entertainment",
    "Salary",
    "Allowance",
    "Other"
];

const MAX_AMOUNT = 100000000;

function isValidDate(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

function isFutureDate(value) {
    const today = new Date().toISOString().slice(0, 10);
    return value > today;
}

function validateTransaction(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return "A valid JSON object is required.";
    }

    if (typeof body.title !== "string" ||
        body.title.trim().length < 1 ||
        body.title.trim().length > 80) {
        return "Title must contain between 1 and 80 characters.";
    }

    if (typeof body.amount !== "number" ||
        !Number.isFinite(body.amount) ||
        body.amount <= 0 ||
        body.amount > MAX_AMOUNT ||
        Math.round(body.amount * 100) / 100 !== body.amount) {
        return "Amount must be positive and have at most two decimal places.";
    }

    if (!VALID_TYPES.includes(body.type)) {
        return "Type must be income or expense.";
    }

    if (!VALID_CATEGORIES.includes(body.category)) {
        return "Please select a valid category.";
    }

    if (!isValidDate(body.date) || isFutureDate(body.date)) {
        return "Enter a valid date that is not in the future.";
    }

    return null;
}

function sendDatabaseError(res, error) {
    // Log technical details only on the server.
    console.error("Database operation failed:", error.message);

    return res.status(500).json({
        success: false,
        message: "The database operation failed."
    });
}

// GET /api/transactions
router.get("/", async (req, res) => {
    try {
        let query = supabase
            .from("transactions")
            .select("id, title, amount, type, category, transaction_date, created_at")
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false });

        if (req.query.type !== undefined) {
            if (!VALID_TYPES.includes(req.query.type)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid transaction type."
                });
            }

            query = query.eq("type", req.query.type);
        }

        if (req.query.month !== undefined) {
            if (!/^\d{4}-\d{2}$/.test(req.query.month)) {
                return res.status(400).json({
                    success: false,
                    message: "Month must use YYYY-MM format."
                });
            }

            const [year, month] = req.query.month.split("-").map(Number);

            if (month < 1 || month > 12) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid month."
                });
            }

            const start = `${req.query.month}-01`;
            const endDate = new Date(Date.UTC(year, month, 1));
            const end = endDate.toISOString().slice(0, 10);

            query = query
                .gte("transaction_date", start)
                .lt("transaction_date", end);
        }

        const { data, error } = await query;

        if (error) return sendDatabaseError(res, error);

        const transactions = data.map((item) => ({
            id: item.id,
            title: item.title,
            amount: Number(item.amount),
            type: item.type,
            category: item.category,
            date: item.transaction_date
        }));

        return res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
});

// POST /api/transactions
router.post("/", async (req, res) => {
    const validationError = validateTransaction(req.body);

    if (validationError) {
        return res.status(400).json({
            success: false,
            message: validationError
        });
    }

    try {
        const newTransaction = {
            id: randomUUID(),
            title: req.body.title.trim(),
            amount: req.body.amount,
            type: req.body.type,
            category: req.body.category,
            transaction_date: req.body.date
        };

        const { data, error } = await supabase
            .from("transactions")
            .insert(newTransaction)
            .select("id, title, amount, type, category, transaction_date")
            .single();

        if (error) return sendDatabaseError(res, error);

        return res.status(201).json({
            success: true,
            message: "Transaction added successfully.",
            data: {
                id: data.id,
                title: data.title,
                amount: Number(data.amount),
                type: data.type,
                category: data.category,
                date: data.transaction_date
            }
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
});

// PUT /api/transactions/:id
router.put("/:id", async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid transaction ID."
        });
    }

    const validationError = validateTransaction(req.body);

    if (validationError) {
        return res.status(400).json({
            success: false,
            message: validationError
        });
    }

    try {
        const updates = {
            title: req.body.title.trim(),
            amount: req.body.amount,
            type: req.body.type,
            category: req.body.category,
            transaction_date: req.body.date
        };

        const { data, error } = await supabase
            .from("transactions")
            .update(updates)
            .eq("id", req.params.id)
            .select("id, title, amount, type, category, transaction_date")
            .maybeSingle();

        if (error) return sendDatabaseError(res, error);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found."
            });
        }

        return res.json({
            success: true,
            message: "Transaction updated successfully.",
            data: {
                id: data.id,
                title: data.title,
                amount: Number(data.amount),
                type: data.type,
                category: data.category,
                date: data.transaction_date
            }
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
});

// DELETE /api/transactions/:id
router.delete("/:id", async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid transaction ID."
        });
    }

    try {
        const { data, error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", req.params.id)
            .select("id")
            .maybeSingle();

        if (error) return sendDatabaseError(res, error);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found."
            });
        }

        return res.json({
            success: true,
            message: "Transaction deleted successfully."
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
});

module.exports = router;
