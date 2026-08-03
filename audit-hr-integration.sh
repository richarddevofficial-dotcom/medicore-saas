#!/usr/bin/env bash

set -u

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/medicore-saas}"
FRONTEND="$PROJECT_ROOT/frontend"
BACKEND="$PROJECT_ROOT/backend"

PASS=0
FAIL=0
WARN=0

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[1;33m'
blue='\033[0;34m'
reset='\033[0m'

pass() {
  echo -e "${green}PASS${reset}  $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "${red}FAIL${reset}  $1"
  FAIL=$((FAIL + 1))
}

warn() {
  echo -e "${yellow}WARN${reset}  $1"
  WARN=$((WARN + 1))
}

section() {
  echo
  echo -e "${blue}========================================${reset}"
  echo -e "${blue}$1${reset}"
  echo -e "${blue}========================================${reset}"
}

check_file() {
  local file="$1"

  if [[ -f "$file" ]]; then
    pass "File exists: ${file#$PROJECT_ROOT/}"
  else
    fail "Missing file: ${file#$PROJECT_ROOT/}"
  fi
}

check_non_empty_file() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    fail "Missing file: ${file#$PROJECT_ROOT/}"
    return
  fi

  if [[ -s "$file" ]]; then
    pass "File is not empty: ${file#$PROJECT_ROOT/}"
  else
    fail "File is empty: ${file#$PROJECT_ROOT/}"
  fi
}

check_pattern() {
  local pattern="$1"
  local file="$2"
  local description="$3"

  if [[ ! -f "$file" ]]; then
    fail "$description — file missing: ${file#$PROJECT_ROOT/}"
    return
  fi

  if grep -qE "$pattern" "$file"; then
    pass "$description"
  else
    fail "$description"
  fi
}

section "1. Project structure"

check_file "$BACKEND/manage.py"
check_file "$BACKEND/human_resources/models.py"
check_file "$BACKEND/human_resources/serializers.py"
check_file "$BACKEND/human_resources/views.py"
check_file "$BACKEND/human_resources/urls.py"

check_file "$FRONTEND/package.json"
check_non_empty_file "$FRONTEND/src/lib/api/hr.js"
check_non_empty_file "$FRONTEND/src/services/hr.js"

section "2. Django HR models"

MODEL_FILE="$BACKEND/human_resources/models.py"

check_pattern '^class Employee\(' "$MODEL_FILE" "Employee model exists"
check_pattern '^class JobPosition\(' "$MODEL_FILE" "JobPosition model exists"
check_pattern '^class EmploymentContract\(' "$MODEL_FILE" "EmploymentContract model exists"
check_pattern '^class Shift\(' "$MODEL_FILE" "Shift model exists"
check_pattern '^class ShiftAssignment\(' "$MODEL_FILE" "ShiftAssignment model exists"
check_pattern '^class Attendance\(' "$MODEL_FILE" "Attendance model exists"
check_pattern '^class LeaveType\(' "$MODEL_FILE" "LeaveType model exists"
check_pattern '^class LeaveBalance\(' "$MODEL_FILE" "LeaveBalance model exists"
check_pattern '^class LeaveRequest\(' "$MODEL_FILE" "LeaveRequest model exists"

section "3. Django serializers"

SERIALIZER_FILE="$BACKEND/human_resources/serializers.py"

check_pattern '^class EmployeeSerializer\(' "$SERIALIZER_FILE" "Employee serializer exists"
check_pattern '^class JobPositionSerializer\(' "$SERIALIZER_FILE" "Position serializer exists"
check_pattern '^class EmploymentContractSerializer\(' "$SERIALIZER_FILE" "Contract serializer exists"
check_pattern '^class ShiftSerializer\(' "$SERIALIZER_FILE" "Shift serializer exists"
check_pattern '^class ShiftAssignmentSerializer\(' "$SERIALIZER_FILE" "Shift assignment serializer exists"
check_pattern '^class AttendanceSerializer\(' "$SERIALIZER_FILE" "Attendance serializer exists"
check_pattern '^class LeaveTypeSerializer\(' "$SERIALIZER_FILE" "Leave type serializer exists"
check_pattern '^class LeaveBalanceSerializer\(' "$SERIALIZER_FILE" "Leave balance serializer exists"
check_pattern '^class LeaveRequestSerializer\(' "$SERIALIZER_FILE" "Leave request serializer exists"

section "4. Django ViewSets"

VIEW_FILE="$BACKEND/human_resources/views.py"

check_pattern '^class EmployeeViewSet\(' "$VIEW_FILE" "Employee ViewSet exists"
check_pattern '^class JobPositionViewSet\(' "$VIEW_FILE" "Position ViewSet exists"
check_pattern '^class EmploymentContractViewSet\(' "$VIEW_FILE" "Contract ViewSet exists"
check_pattern '^class ShiftViewSet\(' "$VIEW_FILE" "Shift ViewSet exists"
check_pattern '^class ShiftAssignmentViewSet\(' "$VIEW_FILE" "Shift assignment ViewSet exists"
check_pattern '^class AttendanceViewSet\(' "$VIEW_FILE" "Attendance ViewSet exists"
check_pattern '^class LeaveTypeViewSet\(' "$VIEW_FILE" "Leave type ViewSet exists"
check_pattern '^class LeaveBalanceViewSet\(' "$VIEW_FILE" "Leave balance ViewSet exists"
check_pattern '^class LeaveRequestViewSet\(' "$VIEW_FILE" "Leave request ViewSet exists"
check_pattern 'def hr_dashboard\(' "$VIEW_FILE" "HR dashboard API exists"

section "5. Django HR routes"

URL_FILE="$BACKEND/human_resources/urls.py"

routes=(
  'employees'
  'positions'
  'contracts'
  'documents'
  'shifts'
  'shift-assignments'
  'attendance'
  'leave-types'
  'leave-balances'
  'leave-requests'
  'departments'
)

for route in "${routes[@]}"; do
  check_pattern "\"${route}\"" "$URL_FILE" "Route registered: /api/v1/hr/${route}/"
done

check_pattern 'path\("dashboard/"' "$URL_FILE" "Route registered: /api/v1/hr/dashboard/"

section "6. Main Django route inclusion"

MAIN_URL_FILE="$BACKEND/config/urls.py"

check_pattern 'human_resources\.urls' "$MAIN_URL_FILE" \
  "Human resources URLs included in config/urls.py"

section "7. Frontend HR API functions"

API_FILE="$FRONTEND/src/lib/api/hr.js"

api_functions=(
  getHRDashboard
  getEmployees
  createEmployee
  updateEmployee
  deleteEmployee
  getDepartments
  createDepartment
  updateDepartment
  deleteDepartment
  getPositions
  createPosition
  updatePosition
  deletePosition
  getContracts
  createContract
  updateContract
  deleteContract
  getShifts
  createShift
  updateShift
  deleteShift
  getShiftAssignments
  createShiftAssignment
  updateShiftAssignment
  deleteShiftAssignment
  getAttendance
  createAttendance
  updateAttendance
  deleteAttendance
  getLeaveTypes
  createLeaveType
  updateLeaveType
  deleteLeaveType
  getLeaveBalances
  allocateLeaveBalance
  getLeaveRequests
  createLeaveRequest
  updateLeaveRequest
  deleteLeaveRequest
  approveLeaveRequest
  rejectLeaveRequest
)

for fn in "${api_functions[@]}"; do
  check_pattern "export function ${fn}\\(" "$API_FILE" \
    "Frontend API function exists: ${fn}()"
done

section "8. Frontend HR service exports"

SERVICE_FILE="$FRONTEND/src/services/hr.js"

check_pattern 'export const hrApi' "$SERVICE_FILE" "hrApi service object is exported"
check_pattern 'export function getApiError' "$SERVICE_FILE" "getApiError helper is exported"
check_pattern 'normalizeResults' "$SERVICE_FILE" "normalizeResults is available"

for fn in \
  getEmployees \
  getDepartments \
  getPositions \
  getContracts \
  getShifts \
  getShiftAssignments \
  getAttendance \
  getLeaveTypes \
  getLeaveBalances \
  getLeaveRequests
do
  check_pattern "${fn}" "$SERVICE_FILE" \
    "hrApi exposes ${fn}"
done

section "9. Frontend HR pages"

declare -A pages=(
  ["HR dashboard"]="hr/page.js"
  ["Employees"]="hr/employees/page.js"
  ["Departments"]="hr/departments/page.js"
  ["Positions"]="hr/positions/page.js"
  ["Contracts"]="hr/contracts/page.js"
  ["Shifts"]="hr/shifts/page.js"
  ["Shift assignments"]="hr/shift-assignments/page.js"
  ["Attendance"]="hr/attendance/page.js"
  ["Leave types"]="hr/leave-types/page.js"
  ["Leave balances"]="hr/leave-balances/page.js"
  ["Leave requests"]="hr/leave-requests/page.js"
)

for page_name in "${!pages[@]}"; do
  page_path="$FRONTEND/src/app/(dashboard)/${pages[$page_name]}"

  if [[ -f "$page_path" ]]; then
    pass "$page_name frontend page exists"
  else
    warn "$page_name frontend page is missing: ${pages[$page_name]}"
  fi
done

section "10. Frontend pages using HR service"

while IFS= read -r page_file; do
  relative="${page_file#$FRONTEND/}"

  if grep -q '@/services/hr' "$page_file"; then
    pass "$relative imports @/services/hr"
  elif grep -q '@/lib/api/hr' "$page_file"; then
    warn "$relative imports @/lib/api/hr directly"
  else
    warn "$relative does not appear to import the HR API"
  fi
done < <(
  find "$FRONTEND/src/app/(dashboard)/hr" \
    -type f \
    -name 'page.js' \
    2>/dev/null \
    | sort
)

section "11. JavaScript import checks"

if command -v npm >/dev/null 2>&1; then
  pass "npm is installed"
else
  fail "npm is not installed"
fi

if [[ -d "$FRONTEND/node_modules" ]]; then
  pass "Frontend node_modules exists"
else
  warn "Frontend node_modules is missing; run npm install"
fi

section "12. Django system checks"

if [[ -f "$BACKEND/manage.py" ]]; then
  cd "$BACKEND"

  if python manage.py check; then
    pass "Django system check passed"
  else
    fail "Django system check failed"
  fi

  migration_output="$(python manage.py makemigrations --check --dry-run 2>&1)"
  migration_status=$?

  echo "$migration_output"

  if [[ $migration_status -eq 0 ]]; then
    pass "No uncommitted model changes detected"
  else
    fail "Model changes exist without migrations"
  fi
fi

section "13. Frontend production build"

cd "$FRONTEND"

if npm run build; then
  pass "Frontend production build passed"
else
  fail "Frontend production build failed"
fi

section "14. Docker services"

cd "$PROJECT_ROOT"

if command -v docker >/dev/null 2>&1; then
  pass "Docker is installed"

  if docker compose ps; then
    pass "Docker Compose status command succeeded"
  else
    fail "Docker Compose status command failed"
  fi
else
  warn "Docker is not available"
fi

section "15. Live API endpoint checks"

API_BASE="${API_BASE:-https://api.medicorecloud.com/api/v1}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

live_endpoints=(
  "hr/dashboard/"
  "hr/employees/"
  "hr/departments/"
  "hr/positions/"
  "hr/contracts/"
  "hr/shifts/"
  "hr/shift-assignments/"
  "hr/attendance/"
  "hr/leave-types/"
  "hr/leave-balances/"
  "hr/leave-requests/"
)

if [[ -z "$ACCESS_TOKEN" ]]; then
  warn "ACCESS_TOKEN is not set; authenticated live API tests skipped"
  echo "Run later with:"
  echo "ACCESS_TOKEN='your-jwt-token' ./audit-hr-integration.sh"
else
  for endpoint in "${live_endpoints[@]}"; do
    url="${API_BASE}/${endpoint}"

    http_code="$(
      curl \
        --silent \
        --output /tmp/hr-api-response.json \
        --write-out '%{http_code}' \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Accept: application/json" \
        "$url"
    )"

    case "$http_code" in
      200)
        pass "GET $url returned HTTP 200"
        ;;
      401)
        fail "GET $url returned HTTP 401 — token rejected or expired"
        ;;
      403)
        fail "GET $url returned HTTP 403 — permission or hospital scope issue"
        ;;
      404)
        fail "GET $url returned HTTP 404 — endpoint missing"
        ;;
      500)
        fail "GET $url returned HTTP 500 — backend error"
        ;;
      *)
        warn "GET $url returned HTTP $http_code"
        ;;
    esac
  done
fi

section "Audit summary"

echo -e "${green}Passed:${reset}  $PASS"
echo -e "${red}Failed:${reset}  $FAIL"
echo -e "${yellow}Warnings:${reset} $WARN"

echo

if [[ $FAIL -eq 0 ]]; then
  echo -e "${green}HR integration audit completed without critical failures.${reset}"
  exit 0
else
  echo -e "${red}HR integration still has critical failures.${reset}"
  exit 1
fi
