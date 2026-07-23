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
