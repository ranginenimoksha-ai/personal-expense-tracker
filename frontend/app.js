"use strict";

// All requests go through the Express backend.
// Do not put Supabase credentials in this file.
const API = "/api";

const $ = (selector) => document.querySelector(selector);

const state = {
  expenses: [],
  income: [],
  categories: [],
  budgets: [],
  report: null,
  deleteAction: null,
  noticeTimer: null
};

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function todayString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

function currentMonth() {
  return todayString().slice(0, 7);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return escapeHTML(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function showNotice(message, type = "success") {
  const notice = $("#notice");

  clearTimeout(state.noticeTimer);

  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;

  state.noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 4500);
}

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error(
      "Cannot connect to the backend. Make sure the Express server is running."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "The request failed.");
  }

  return result;
}

function setButtonLoading(button, loading, loadingText = "Saving...") {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.textContent =
      button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

function selectedMonth() {
  return $("#monthPicker").value || currentMonth();
}

function monthDateRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);

  const end = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 10);

  return {
    from: `${month}-01`,
    to: end
  };
}

function categoryName(categoryId) {
  const category = state.categories.find(
    (item) => item.id === categoryId
  );

  return category ? category.name : "Unknown category";
}

// -------------------- NAVIGATION --------------------

function navigate(page) {
  const validPages = [
    "dashboard",
    "expenses",
    "income",
    "budgets",
    "reports"
  ];

  if (!validPages.includes(page)) page = "dashboard";

  document.querySelectorAll(".page").forEach((section) => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const titles = {
    dashboard: "Dashboard",
    expenses: "Expenses",
    income: "Income",
    budgets: "Budgets",
    reports: "Reports"
  };

  $("#pageTitle").textContent = titles[page];
  $("#sidebar").classList.remove("open");

  if (page === "dashboard") {
    loadDashboard().catch(showError);
  } else if (page === "expenses") {
    renderExpenses();
  } else if (page === "income") {
    renderIncome();
  } else if (page === "budgets") {
    loadBudgets().catch(showError);
  } else if (page === "reports") {
    loadReport().catch(showError);
  }
}

function showError(error) {
  showNotice(error.message || "Something went wrong.", "error");
}

// -------------------- CATEGORIES --------------------

function renderCategoryOptions() {
  const expenseCategories = state.categories.filter(
    (category) => category.type === "expense"
  );

  const incomeCategories = state.categories.filter(
    (category) => category.type === "income"
  );

  const options = (items) =>
    items.map((category) =>
      `<option value="${escapeHTML(category.id)}">${escapeHTML(category.name)}</option>`
    ).join("");

  $("#expenseCategory").innerHTML =
    '<option value="">Choose a category</option>' +
    options(expenseCategories);

  $("#expenseFilterCategory").innerHTML =
    '<option value="">All categories</option>' +
    options(expenseCategories);

  $("#budgetCategory").innerHTML =
    '<option value="">Choose a category</option>' +
    options(expenseCategories);

  // The current backend records income by source, without a category ID.
  // Income categories are therefore not needed by the income form.
  void incomeCategories;
}

async function loadCategories() {
  const result = await apiRequest("/categories");
  state.categories = result.data || [];
  renderCategoryOptions();
}

// -------------------- EXPENSES --------------------

async function loadExpenses() {
  const result = await apiRequest("/expenses");
  state.expenses = result.data || [];
  renderExpenses();
}

function filteredExpenses() {
  const search = $("#expenseSearch").value.trim().toLowerCase();
  const categoryId = $("#expenseFilterCategory").value;
  const from = $("#expenseFilterFrom").value;
  const to = $("#expenseFilterTo").value;

  return state.expenses.filter((expense) => {
    const matchesSearch = String(expense.description || "")
      .toLowerCase()
      .includes(search);

    const matchesCategory =
      !categoryId || expense.category_id === categoryId;

    const matchesFrom = !from || expense.expense_date >= from;
    const matchesTo = !to || expense.expense_date <= to;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesFrom &&
      matchesTo
    );
  });
}

function renderExpenses() {
  const filtered = filteredExpenses();

  $("#expenseCount").textContent =
    `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;

  const tbody = $("#expenseTableBody");

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No expenses found. Add an expense or change your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((expense) => `
    <tr>
      <td>${escapeHTML(expense.description)}</td>
      <td><span class="category-tag">${escapeHTML(categoryName(expense.category_id))}</span></td>
      <td>${formatDate(expense.expense_date)}</td>
      <td class="align-right amount-expense">${money(expense.amount)}</td>
      <td>
        <div class="action-group">
          <button class="action-button" data-edit-expense="${escapeHTML(expense.id)}"
            type="button">Edit</button>
          <button class="action-button delete" data-delete-expense="${escapeHTML(expense.id)}"
            type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function resetExpenseForm() {
  $("#expenseForm").reset();
  $("#expenseId").value = "";
  $("#expenseDate").value = todayString();
  $("#expenseFormTitle").textContent = "Add an expense";
  $("#expenseSubmit").textContent = "Save expense";
  $("#expenseCancel").hidden = true;
}

function editExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;

  $("#expenseId").value = expense.id;
  $("#expenseDescription").value = expense.description;
  $("#expenseAmount").value = expense.amount;
  $("#expenseCategory").value = expense.category_id;
  $("#expenseDate").value = expense.expense_date;

  $("#expenseFormTitle").textContent = "Edit expense";
  $("#expenseSubmit").textContent = "Update expense";
  $("#expenseCancel").hidden = false;

  $("#expenseForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function submitExpense(event) {
  event.preventDefault();

  const id = $("#expenseId").value;
  const payload = {
    description: $("#expenseDescription").value.trim(),
    amount: Number($("#expenseAmount").value),
    category_id: $("#expenseCategory").value,
    expense_date: $("#expenseDate").value
  };

  const button = $("#expenseSubmit");

  setButtonLoading(button, true);

  try {
    const result = await apiRequest(
      id ? `/expenses/${encodeURIComponent(id)}` : "/expenses",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );

    resetExpenseForm();

    await refreshData();

    showNotice(result.message || "Expense saved successfully.");
  } catch (error) {
    showError(error);
  } finally {
    setButtonLoading(button, false);
  }
}

// -------------------- INCOME --------------------

async function loadIncome() {
  const result = await apiRequest("/income");
  state.income = result.data || [];
  renderIncome();
}

function renderIncome() {
  const tbody = $("#incomeTableBody");

  $("#incomeCount").textContent =
    `${state.income.length} record${state.income.length === 1 ? "" : "s"}`;

  if (state.income.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="empty-state">No income records yet.</td></tr>';
    return;
  }

  tbody.innerHTML = state.income.map((item) => `
    <tr>
      <td>${escapeHTML(item.source)}</td>
      <td>${formatDate(item.income_date)}</td>
      <td class="align-right amount-income">${money(item.amount)}</td>
      <td>
        <div class="action-group">
          <button class="action-button" data-edit-income="${escapeHTML(item.id)}"
            type="button">Edit</button>
          <button class="action-button delete" data-delete-income="${escapeHTML(item.id)}"
            type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function resetIncomeForm() {
  $("#incomeForm").reset();
  $("#incomeId").value = "";
  $("#incomeDate").value = todayString();
  $("#incomeFormTitle").textContent = "Add income";
  $("#incomeSubmit").textContent = "Save income";
  $("#incomeCancel").hidden = true;
}

function editIncome(id) {
  const item = state.income.find((income) => income.id === id);
  if (!item) return;

  $("#incomeId").value = item.id;
  $("#incomeSource").value = item.source;
  $("#incomeAmount").value = item.amount;
  $("#incomeDate").value = item.income_date;

  $("#incomeFormTitle").textContent = "Edit income";
  $("#incomeSubmit").textContent = "Update income";
  $("#incomeCancel").hidden = false;

  $("#incomeForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function submitIncome(event) {
  event.preventDefault();

  const id = $("#incomeId").value;
  const payload = {
    source: $("#incomeSource").value.trim(),
    amount: Number($("#incomeAmount").value),
    income_date: $("#incomeDate").value
  };

  const button = $("#incomeSubmit");
  setButtonLoading(button, true);

  try {
    const result = await apiRequest(
      id ? `/income/${encodeURIComponent(id)}` : "/income",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );

    resetIncomeForm();
    await refreshData();

    showNotice(result.message || "Income saved successfully.");
  } catch (error) {
    showError(error);
  } finally {
    setButtonLoading(button, false);
  }
}

// -------------------- BUDGETS --------------------

async function loadBudgets() {
  const month = selectedMonth();

  $("#budgetMonth").value = month;

  const result = await apiRequest(
    `/budgets?month=${encodeURIComponent(month)}`
  );

  state.budgets = result.data || [];
  renderBudgets();
}

function renderBudgets() {
  const container = $("#budgetCards");

  if (state.budgets.length === 0) {
    container.innerHTML = `
      <article class="panel">
        <p class="empty-state">
          No budgets for this month. Use the form above to create your first budget.
        </p>
      </article>
    `;
    return;
  }

  container.innerHTML = state.budgets.map((budget) => {
    const limit = Number(budget.amount);
    const spent = Number(budget.spent);
    const remaining = limit - spent;
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    const width = Math.min(percentage, 100);

    let status = "Within budget";
    let statusClass = "";

    if (percentage >= 100) {
      status = "Budget exceeded";
      statusClass = "danger";
    } else if (percentage >= 80) {
      status = "Near limit";
      statusClass = "warning";
    }

    return `
      <article class="panel">
        <div class="panel-header">
          <div>
            <h3>${escapeHTML(categoryName(budget.category_id))}</h3>
            <p class="muted">${escapeHTML(budget.month)}</p>
          </div>
          <button class="action-button delete"
            data-delete-budget="${escapeHTML(budget.id)}"
            type="button">Delete</button>
        </div>

        <span class="budget-status ${statusClass}">${status}</span>

        <div class="budget-amounts">
          <span>Spent <strong>${money(spent)}</strong></span>
          <span>Limit <strong>${money(limit)}</strong></span>
        </div>

        <div class="progress-track">
          <div class="progress-fill"
            style="width:${width}%;${percentage >= 100 ? "background:var(--red)" : ""}">
          </div>
        </div>

        <div class="budget-sub">
          <span>${percentage.toFixed(1)}% used</span>
          <span class="${remaining < 0 ? "over-budget" : ""}">
            ${remaining < 0 ? "Over by " + money(Math.abs(remaining)) : money(remaining) + " left"}
          </span>
        </div>
      </article>
    `;
  }).join("");
}

async function submitBudget(event) {
  event.preventDefault();

  const payload = {
    category_id: $("#budgetCategory").value,
    amount: Number($("#budgetAmount").value),
    month: $("#budgetMonth").value
  };

  const button = event.submitter || $("#budgetForm button[type='submit']");
  setButtonLoading(button, true);

  try {
    const result = await apiRequest("/budgets", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    $("#monthPicker").value = payload.month;

    await refreshData();
    navigate("budgets");

    showNotice(result.message || "Budget saved successfully.");
  } catch (error) {
    showError(error);
  } finally {
    setButtonLoading(button, false);
  }
}

// -------------------- REPORTS --------------------

async function loadReport() {
  const month = selectedMonth();

  const result = await apiRequest(
    `/reports/monthly?month=${encodeURIComponent(month)}`
  );

  state.report = result.data;

  renderReport();
  renderDashboardStats();
  renderCategoryChart(
    $("#categoryChart"),
    state.report.categoryBreakdown
  );
}

function renderReport() {
  if (!state.report) return;

  $("#reportIncome").textContent = money(state.report.totalIncome);
  $("#reportExpenses").textContent = money(state.report.totalExpenses);
  $("#reportBalance").textContent = money(state.report.balance);
  $("#reportBudget").textContent = money(state.report.totalBudget);

  renderCategoryChart(
    $("#reportChart"),
    state.report.categoryBreakdown
  );
}

function renderCategoryChart(container, breakdown = []) {
  if (!breakdown || breakdown.length === 0) {
    container.innerHTML =
      '<p class="empty-state">No expenses recorded for this month.</p>';
    return;
  }

  const maxTotal = Math.max(...breakdown.map((item) => Number(item.total)), 1);

  container.innerHTML = breakdown.map((item) => {
    const width = (Number(item.total) / maxTotal) * 100;

    return `
      <div class="category-row">
        <div class="category-row-top">
          <span class="category-name">${escapeHTML(item.category)}</span>
          <span class="category-total">${money(item.total)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderDashboardStats() {
  if (!state.report) return;

  $("#balanceValue").textContent = money(state.report.balance);
  $("#incomeValue").textContent = money(state.report.totalIncome);
  $("#expenseValue").textContent = money(state.report.totalExpenses);

  const totalBudget = Number(state.report.totalBudget);
  const remaining = Number(state.report.budgetRemaining);

  $("#budgetValue").textContent =
    totalBudget > 0 ? money(remaining) : "—";

  $("#budgetCaption").textContent = totalBudget > 0
    ? (remaining < 0 ? "Amount over your budget" : "Budget remaining")
    : "Set a budget to track your limits";
}

function renderRecentExpenses() {
  const tbody = $("#recentExpenses");

  const range = monthDateRange(selectedMonth());

  const recent = state.expenses
    .filter((expense) =>
      expense.expense_date >= range.from &&
      expense.expense_date < range.to
    )
    .sort((a, b) =>
      b.expense_date.localeCompare(a.expense_date)
    )
    .slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="empty-state">No expenses for this month yet.</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map((expense) => `
    <tr>
      <td>${escapeHTML(expense.description)}</td>
      <td><span class="category-tag">${escapeHTML(categoryName(expense.category_id))}</span></td>
      <td>${formatDate(expense.expense_date)}</td>
      <td class="align-right amount-expense">${money(expense.amount)}</td>
    </tr>
  `).join("");
}

function renderDashboardBudgets() {
  const container = $("#budgetOverview");

  if (state.budgets.length === 0) {
    container.innerHTML =
      '<p class="empty-state">No budgets yet. Create one to monitor spending.</p>';
    return;
  }

  container.innerHTML = state.budgets.slice(0, 5).map((budget) => {
    const limit = Number(budget.amount);
    const spent = Number(budget.spent);
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;

    return `
      <div class="budget-item">
        <div class="budget-top">
          <span>${escapeHTML(categoryName(budget.category_id))}</span>
          <span class="${percentage >= 100 ? "over-budget" : ""}">
            ${Math.round(percentage)}%
          </span>
        </div>
        <div class="progress-track">
          <div class="progress-fill"
            style="width:${Math.min(percentage, 100)}%;${percentage >= 100 ? "background:var(--red)" : ""}">
          </div>
        </div>
        <div class="budget-sub">
          <span>${money(spent)} spent</span>
          <span>of ${money(limit)}</span>
        </div>
      </div>
    `;
  }).join("");
}

async function loadDashboard() {
  const results = await Promise.all([
    apiRequest(
      `/reports/monthly?month=${encodeURIComponent(selectedMonth())}`
    ),
    apiRequest(
      `/budgets?month=${encodeURIComponent(selectedMonth())}`
    )
  ]);

  state.report = results[0].data;
  state.budgets = results[1].data || [];

  renderExpenses();
  renderIncome();
  renderDashboardStats();
  renderReport();
  renderCategoryChart(
    $("#categoryChart"),
    state.report.categoryBreakdown
  );
  renderRecentExpenses();
  renderDashboardBudgets();
}

// -------------------- DELETE CONFIRMATION --------------------

function askToDelete(message, action) {
  const dialog = $("#confirmDialog");
  const description = dialog.querySelector("p");

  description.textContent = message;
  state.deleteAction = action;

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    const confirmed = window.confirm(message);
    if (confirmed) action();
  }
}

async function deleteRecord(type, id) {
  const endpoints = {
    expense: "/expenses/",
    income: "/income/",
    budget: "/budgets/"
  };

  const result = await apiRequest(
    endpoints[type] + encodeURIComponent(id),
    { method: "DELETE" }
  );

  if (type === "expense") resetExpenseForm();
  if (type === "income") resetIncomeForm();

  await refreshData();

  showNotice(result.message || "Record deleted successfully.");
}

// -------------------- REFRESH DATA --------------------

async function refreshData() {
  await Promise.all([
    loadCategories(),
    loadExpenses(),
    loadIncome()
  ]);

  await loadDashboard();

  if ($("#page-budgets").classList.contains("active")) {
    await loadBudgets();
  }

  if ($("#page-reports").classList.contains("active")) {
    await loadReport();
  }
}

// -------------------- CSV EXPORT --------------------

function downloadCSV() {
  const breakdown = state.report?.categoryBreakdown || [];

  const rows = [
    ["Personal Expense Tracker Monthly Report"],
    ["Month", selectedMonth()],
    [],
    ["Category", "Total Expenses (INR)"],
    ...breakdown.map((item) => [item.category, item.total]),
    [],
    ["Total Income", state.report?.totalIncome || 0],
    ["Total Expenses", state.report?.totalExpenses || 0],
    ["Net Balance", state.report?.balance || 0],
    ["Total Budget", state.report?.totalBudget || 0]
  ];

  const csv = rows.map((row) =>
    row.map((cell) => {
      let value = String(cell ?? "");

      // Prevent spreadsheet formula injection in text fields.
      if (/^[\s]*[=+\-@]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value)) {
        value = "'" + value;
      }

      return `"${value.replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `expense-report-${selectedMonth()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showNotice("Monthly report exported.");
}

// -------------------- EVENT LISTENERS --------------------

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(link.dataset.page);
    history.replaceState(null, "", `#${link.dataset.page}`);
  });
});

window.addEventListener("hashchange", () => {
  navigate(location.hash.slice(1));
});

$("#menuButton").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

$("#quickAddButton").addEventListener("click", () => {
  navigate("expenses");
  resetExpenseForm();
  $("#expenseDescription").focus();
});

$("#monthPicker").addEventListener("change", async () => {
  try {
    await loadDashboard();

    if ($("#page-budgets").classList.contains("active")) {
      await loadBudgets();
    }

    if ($("#page-reports").classList.contains("active")) {
      await loadReport();
    }
  } catch (error) {
    showError(error);
  }
});

$("#expenseForm").addEventListener("submit", submitExpense);
$("#expenseCancel").addEventListener("click", resetExpenseForm);

$("#incomeForm").addEventListener("submit", submitIncome);
$("#incomeCancel").addEventListener("click", resetIncomeForm);

$("#budgetForm").addEventListener("submit", submitBudget);

["expenseSearch", "expenseFilterCategory",
  "expenseFilterFrom", "expenseFilterTo"].forEach((id) => {
  $(`#${id}`).addEventListener(
    id === "expenseSearch" ? "input" : "change",
    renderExpenses
  );
});

$("#clearExpenseFilters").addEventListener("click", () => {
  $("#expenseSearch").value = "";
  $("#expenseFilterCategory").value = "";
  $("#expenseFilterFrom").value = "";
  $("#expenseFilterTo").value = "";
  renderExpenses();
});

$("#exportReport").addEventListener("click", downloadCSV);

$("#expenseTableBody").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-expense]");
  const deleteButton = event.target.closest("[data-delete-expense]");

  if (editButton) {
    editExpense(editButton.dataset.editExpense);
  }

  if (deleteButton) {
    const id = deleteButton.dataset.deleteExpense;

    askToDelete("Delete this expense permanently?", async () => {
      await deleteRecord("expense", id);
    });
  }
});

$("#incomeTableBody").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-income]");
  const deleteButton = event.target.closest("[data-delete-income]");

  if (editButton) {
    editIncome(editButton.dataset.editIncome);
  }

  if (deleteButton) {
    const id = deleteButton.dataset.deleteIncome;

    askToDelete("Delete this income record permanently?", async () => {
      await deleteRecord("income", id);
    });
  }
});

$("#budgetCards").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-budget]");
  if (!button) return;

  const id = button.dataset.deleteBudget;

  askToDelete("Delete this monthly budget?", async () => {
    await deleteRecord("budget", id);
  });
});

$("#confirmDelete").addEventListener("click", async (event) => {
  if (!state.deleteAction) return;

  event.preventDefault();

  const action = state.deleteAction;
  state.deleteAction = null;

  $("#confirmDialog").close();

  try {
    await action();
  } catch (error) {
    showError(error);
  }
});

// -------------------- INITIALIZE APPLICATION --------------------

async function initializeApp() {
  $("#monthPicker").value = currentMonth();
  $("#budgetMonth").value = currentMonth();
  $("#expenseDate").value = todayString();
  $("#incomeDate").value = todayString();

  $("#todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const initialPage = location.hash.slice(1) || "dashboard";

  try {
    await Promise.all([
      loadCategories(),
      loadExpenses(),
      loadIncome()
    ]);

    await loadDashboard();
    navigate(initialPage);
  } catch (error) {
    showError(error);
  }
}

initializeApp();