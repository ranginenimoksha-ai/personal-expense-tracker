CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Expense and income categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL
        CHECK (type IN ('expense', 'income')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, type)
);

-- Expense records
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description VARCHAR(200) NOT NULL,
    category_id UUID NOT NULL
        REFERENCES categories(id) ON DELETE RESTRICT,
    expense_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Income records
CREATE TABLE IF NOT EXISTS income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    source VARCHAR(200) NOT NULL,
    income_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly category budgets
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL
        REFERENCES categories(id) ON DELETE RESTRICT,
    month DATE NOT NULL
        CHECK (EXTRACT(DAY FROM month) = 1),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, month)
);

-- Indexes for date filtering and category reports
CREATE INDEX IF NOT EXISTS idx_expenses_date
    ON expenses(expense_date);

CREATE INDEX IF NOT EXISTS idx_expenses_category
    ON expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_income_date
    ON income(income_date);

CREATE INDEX IF NOT EXISTS idx_budgets_month
    ON budgets(month);

-- Initial expense categories
INSERT INTO categories (name, type)
VALUES
    ('Food', 'expense'),
    ('Transport', 'expense'),
    ('Shopping', 'expense'),
    ('Education', 'expense'),
    ('Bills', 'expense'),
    ('Entertainment', 'expense'),
    ('Other', 'expense')
ON CONFLICT (name, type) DO NOTHING;