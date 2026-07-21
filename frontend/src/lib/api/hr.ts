import type {
  Department,
  Employee,
  EmployeePayload,
  HRDashboard,
  JobPosition,
  PaginatedResponse,
} from "@/types/hr";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken")
  );
}

function buildHeaders(hasBody = false): HeadersInit {
  const token = getAccessToken();

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access");
      localStorage.removeItem("access_token");
    }

    const errorData = data as
      | { detail?: string; error?: string; message?: string }
      | null;

    throw new Error(
      errorData?.detail ||
        errorData?.error ||
        errorData?.message ||
        `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

export async function getHRDashboard(): Promise<HRDashboard> {
  const response = await fetch(`${API_URL}/api/v1/hr/dashboard/`, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  return parseResponse<HRDashboard>(response);
}

export interface EmployeeFilters {
  search?: string;
  employment_status?: string;
  employment_type?: string;
  department?: string;
  position?: string;
  is_active?: string;
  page?: number;
}

export async function getEmployees(
  filters: EmployeeFilters = {},
): Promise<PaginatedResponse<Employee> | Employee[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  const url = `${API_URL}/api/v1/hr/employees/${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  return parseResponse<PaginatedResponse<Employee> | Employee[]>(response);
}

export async function getEmployee(id: string): Promise<Employee> {
  const response = await fetch(
    `${API_URL}/api/v1/hr/employees/${id}/`,
    {
      headers: buildHeaders(),
      cache: "no-store",
    },
  );

  return parseResponse<Employee>(response);
}

export async function createEmployee(
  payload: EmployeePayload,
): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/v1/hr/employees/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });

  return parseResponse<Employee>(response);
}

export async function updateEmployee(
  id: string,
  payload: Partial<EmployeePayload>,
): Promise<Employee> {
  const response = await fetch(
    `${API_URL}/api/v1/hr/employees/${id}/`,
    {
      method: "PATCH",
      headers: buildHeaders(true),
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<Employee>(response);
}

export async function deactivateEmployee(
  id: number,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_URL}/api/v1/hr/employees/${id}/deactivate/`,
    {
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify({
        employment_status: "TERMINATED",
        termination_date: new Date().toISOString().slice(0, 10),
      }),
    },
  );

  return parseResponse(response);
}

export async function getPositions(): Promise<
  PaginatedResponse<JobPosition> | JobPosition[]
> {
  const response = await fetch(`${API_URL}/api/v1/hr/positions/`, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  return parseResponse(response);
}

export async function getDepartments(): Promise<
  PaginatedResponse<Department> | Department[]
> {
  const response = await fetch(`${API_URL}/api/v1/departments/`, {
    headers: buildHeaders(),
    cache: "no-store",
  });

  return parseResponse(response);
}

export function normalizeResults<T>(
  response: PaginatedResponse<T> | T[],
): T[] {
  return Array.isArray(response) ? response : response.results;
}
