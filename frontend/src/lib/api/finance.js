import apiClient from "@/lib/api-client";

// Finance Dashboard
export async function getFinanceDashboard() {
  try {
    // Fetch key financial data from multiple endpoints
    const [salarySlips, journals, budgets, expenses] = await Promise.all([
      apiClient.get("/finance/salary-slips/"),
      apiClient.get("/finance/accounting/journals/"),
      apiClient.get("/budgets/years/"),
      apiClient.get("/expenses/expenses/"),
    ]);

    return {
      salarySlips: salarySlips.data,
      journals: journals.data,
      budgets: budgets.data,
      expenses: expenses.data,
    };
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load finance dashboard",
    );
  }
}

// Budgets (from budgets app)
export async function getBudgets(params = {}) {
  try {
    const response = await apiClient.get("/budgets/years/", { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to load budgets");
  }
}

export async function getBudget(id) {
  try {
    const response = await apiClient.get(`/budgets/years/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to load budget");
  }
}

export async function createBudget(data) {
  try {
    const response = await apiClient.post("/budgets/years/", data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to create budget");
  }
}

export async function updateBudget(id, data) {
  try {
    const response = await apiClient.put(`/budgets/years/${id}/`, data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to update budget");
  }
}

export async function deleteBudget(id) {
  try {
    await apiClient.delete(`/budgets/years/${id}/`);
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to delete budget");
  }
}

// Expenses (from expenses app)
export async function getExpenses(params = {}) {
  try {
    const response = await apiClient.get("/expenses/expenses/", { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to load expenses");
  }
}

export async function getExpense(id) {
  try {
    const response = await apiClient.get(`/expenses/expenses/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to load expense");
  }
}

export async function createExpense(data) {
  try {
    const response = await apiClient.post("/expenses/expenses/", data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to create expense");
  }
}

export async function updateExpense(id, data) {
  try {
    const response = await apiClient.put(`/expenses/expenses/${id}/`, data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to update expense");
  }
}

export async function deleteExpense(id) {
  try {
    await apiClient.delete(`/expenses/expenses/${id}/`);
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to delete expense");
  }
}

// Payroll (from finance app - salary slips)
export async function getPayroll(params = {}) {
  try {
    const response = await apiClient.get("/finance/salary-slips/", { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to load payroll");
  }
}

export async function getPayrollCycle(id) {
  try {
    const response = await apiClient.get(`/finance/salary-slips/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load payroll cycle",
    );
  }
}

export async function createPayrollCycle(data) {
  try {
    const response = await apiClient.post("/finance/salary-slips/", data);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to create payroll cycle",
    );
  }
}

export async function processPayroll(id) {
  try {
    const response = await apiClient.post(
      `/finance/salary-slips/${id}/approve/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to process payroll",
    );
  }
}

// Payroll Year Management
export async function getPayrollYears(params = {}) {
  try {
    const response = await apiClient.get("/finance/payroll-years/", { params });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load payroll years",
    );
  }
}

export async function getPayrollYear(id) {
  try {
    const response = await apiClient.get(`/finance/payroll-years/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load payroll year",
    );
  }
}

export async function createPayrollYear(data) {
  try {
    const response = await apiClient.post("/finance/payroll-years/", data);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to create payroll year",
    );
  }
}

export async function updatePayrollYear(id, data) {
  try {
    const response = await apiClient.put(`/finance/payroll-years/${id}/`, data);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to update payroll year",
    );
  }
}

export async function deletePayrollYear(id) {
  try {
    const response = await apiClient.delete(`/finance/payroll-years/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to delete payroll year",
    );
  }
}

// Salary Structure Management
export async function getSalaryStructures(params = {}) {
  try {
    const response = await apiClient.get("/finance/salary-structures/", {
      params,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load salary structures",
    );
  }
}

export async function getSalaryStructure(id) {
  try {
    const response = await apiClient.get(`/finance/salary-structures/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load salary structure",
    );
  }
}

export async function createSalaryStructure(data) {
  try {
    const response = await apiClient.post("/finance/salary-structures/", data);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to create salary structure",
    );
  }
}

export async function updateSalaryStructure(id, data) {
  try {
    const response = await apiClient.put(
      `/finance/salary-structures/${id}/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to update salary structure",
    );
  }
}

export async function deleteSalaryStructure(id) {
  try {
    const response = await apiClient.delete(
      `/finance/salary-structures/${id}/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to delete salary structure",
    );
  }
}

export async function calculateSalary(id, data) {
  try {
    const response = await apiClient.post(
      `/finance/salary-structures/${id}/calculate_salary/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to calculate salary",
    );
  }
}

// Allowance and Deduction Types
export async function getAllowanceTypes(params = {}) {
  try {
    const response = await apiClient.get("/finance/allowance-types/", {
      params,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load allowance types",
    );
  }
}

export async function createAllowanceType(data) {
  try {
    const response = await apiClient.post("/finance/allowance-types/", data);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to create allowance type",
    );
  }
}

export async function updateAllowanceType(id, data) {
  try {
    const response = await apiClient.put(
      `/finance/allowance-types/${id}/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to update allowance type",
    );
  }
}

export async function deleteAllowanceType(id) {
  try {
    const response = await apiClient.delete(`/finance/allowance-types/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to delete allowance type",
    );
  }
}

export async function getDeductionTypes(params = {}) {
  try {
    const response = await apiClient.get("/finance/deduction-types/", {
      params,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load deduction types",
    );
  }
}

export async function createDeductionType(data) {
  try {
    const response = await apiClient.post("/finance/deduction-types/", data);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to create deduction type",
    );
  }
}

export async function updateDeductionType(id, data) {
  try {
    const response = await apiClient.put(
      `/finance/deduction-types/${id}/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to update deduction type",
    );
  }
}

export async function deleteDeductionType(id) {
  try {
    const response = await apiClient.delete(`/finance/deduction-types/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to delete deduction type",
    );
  }
}

// Accounting endpoints
export async function getAccounts(params = {}) {
  try {
    const response = await apiClient.get("/finance/accounting/accounts/", {
      params,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to load accounts");
  }
}

export async function getTrialBalance(params = {}) {
  try {
    const response = await apiClient.get(
      "/finance/accounting/reports/trial-balance/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load trial balance",
    );
  }
}

export async function getGeneralLedger(params = {}) {
  try {
    const response = await apiClient.get(
      "/finance/accounting/reports/general-ledger/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load general ledger",
    );
  }
}

export async function getIncomeStatement(params = {}) {
  try {
    const response = await apiClient.get(
      "/finance/accounting/reports/income-statement/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load income statement",
    );
  }
}

export async function getBalanceSheet(params = {}) {
  try {
    const response = await apiClient.get(
      "/finance/accounting/reports/balance-sheet/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load balance sheet",
    );
  }
}

// Chart of Accounts Management
export async function getAccountCategories(params = {}) {
  try {
    const response = await apiClient.get(
      "/finance/accounting/account-categories/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load account categories",
    );
  }
}

export async function getChartOfAccounts(params = {}) {
  try {
    const response = await apiClient.get(
      "/finance/accounting/chart-of-accounts/",
      { params },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load chart of accounts",
    );
  }
}

export async function getAccount(id) {
  try {
    const response = await apiClient.get(
      `/finance/accounting/chart-of-accounts/${id}/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to load account");
  }
}

export async function createAccount(data) {
  try {
    const response = await apiClient.post(
      "/finance/accounting/chart-of-accounts/",
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to create account");
  }
}

export async function updateAccount(id, data) {
  try {
    const response = await apiClient.put(
      `/finance/accounting/chart-of-accounts/${id}/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to update account");
  }
}

export async function deleteAccount(id) {
  try {
    const response = await apiClient.delete(
      `/finance/accounting/chart-of-accounts/${id}/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || "Failed to delete account");
  }
}

export async function activateAccount(id) {
  try {
    const response = await apiClient.post(
      `/finance/accounting/chart-of-accounts/${id}/activate/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to activate account",
    );
  }
}

export async function deactivateAccount(id) {
  try {
    const response = await apiClient.post(
      `/finance/accounting/chart-of-accounts/${id}/deactivate/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to deactivate account",
    );
  }
}

// Journal Entries Management
export async function getJournalEntries(params = {}) {
  try {
    const response = await apiClient.get("/finance/accounting/journals/", {
      params,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load journal entries",
    );
  }
}

export async function getJournalEntry(id) {
  try {
    const response = await apiClient.get(`/finance/accounting/journals/${id}/`);
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to load journal entry",
    );
  }
}

export async function createJournalEntry(data) {
  try {
    const response = await apiClient.post(
      "/finance/accounting/journals/",
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to create journal entry",
    );
  }
}

export async function updateJournalEntry(id, data) {
  try {
    const response = await apiClient.put(
      `/finance/accounting/journals/${id}/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to update journal entry",
    );
  }
}

export async function deleteJournalEntry(id) {
  try {
    const response = await apiClient.delete(
      `/finance/accounting/journals/${id}/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to delete journal entry",
    );
  }
}

export async function postJournalEntry(id) {
  try {
    const response = await apiClient.post(
      `/finance/accounting/journals/${id}/post_journal/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to post journal entry",
    );
  }
}

export async function voidJournalEntry(id, data) {
  try {
    const response = await apiClient.post(
      `/finance/accounting/journals/${id}/void_journal/`,
      data,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to void journal entry",
    );
  }
}

export async function reverseJournalEntry(id) {
  try {
    const response = await apiClient.post(
      `/finance/accounting/journals/${id}/reverse_journal/`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || "Failed to reverse journal entry",
    );
  }
}
