import * as api from "@/lib/api/hr";

const list =
  (fn) =>
  async (...args) => {
    const response = await fn(...args);
    return api.normalizeResults(response);
  };

export const hrApi = {
  getDashboard: api.getHRDashboard,

  // Employees
  getEmployees: list(api.getEmployees),
  getEmployee: api.getEmployee,
  createEmployee: api.createEmployee,
  updateEmployee: api.updateEmployee,
  deactivateEmployee: api.deactivateEmployee,
  deleteEmployee: api.deleteEmployee,

  // Departments
  getDepartments: list(api.getDepartments),
  getDepartment: api.getDepartment,
  createDepartment: api.createDepartment,
  updateDepartment: api.updateDepartment,
  deleteDepartment: api.deleteDepartment,

  // Positions
  getPositions: list(api.getPositions),
  getPosition: api.getPosition,
  createPosition: api.createPosition,
  updatePosition: api.updatePosition,
  deletePosition: api.deletePosition,

  // Contracts
  getContracts: list(api.getContracts),
  getContract: api.getContract,
  createContract: api.createContract,
  updateContract: api.updateContract,
  deleteContract: api.deleteContract,

  // Shifts
  getShifts: list(api.getShifts),
  getShift: api.getShift,
  createShift: api.createShift,
  updateShift: api.updateShift,
  deleteShift: api.deleteShift,

  // Shift Assignments
  getShiftAssignments: list(api.getShiftAssignments),
  createShiftAssignment: api.createShiftAssignment,
  updateShiftAssignment: api.updateShiftAssignment,
  deleteShiftAssignment: api.deleteShiftAssignment,

  // Attendance
  getAttendance: list(api.getAttendance),
  createAttendance: api.createAttendance,
  updateAttendance: api.updateAttendance,
  deleteAttendance: api.deleteAttendance,

  // Leave Types
  getLeaveTypes: list(api.getLeaveTypes),
  createLeaveType: api.createLeaveType,
  updateLeaveType: api.updateLeaveType,
  deleteLeaveType: api.deleteLeaveType,

  // Leave Balances
  getLeaveBalances: list(api.getLeaveBalances),
  allocateLeaveBalance: api.allocateLeaveBalance,

  // Leave Requests
  getLeaveRequests: list(api.getLeaveRequests),
  getLeaveRequest: api.getLeaveRequest,
  createLeaveRequest: api.createLeaveRequest,
  approveLeaveRequest: api.approveLeaveRequest,
  rejectLeaveRequest: api.rejectLeaveRequest,
};

export function getApiError(
  error,
  fallback = "The request could not be completed.",
) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export const { normalizeResults, getHRDashboard } = api;
