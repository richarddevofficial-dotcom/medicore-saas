from django.urls import include, path

from rest_framework.routers import DefaultRouter

from finance.accounting_views import (
    AccountCategoryViewSet,
    BalanceSheetView,
    ChartOfAccountViewSet,
    GeneralLedgerView,
    IncomeStatementView,
    JournalEntryViewSet,
    TrialBalanceView,
)


app_name = "finance-accounting"


router = DefaultRouter()
router.register(
    "account-categories",
    AccountCategoryViewSet,
    basename="account-category",
)
router.register(
    "accounts",
    ChartOfAccountViewSet,
    basename="chart-of-account",
)
router.register(
    "journals",
    JournalEntryViewSet,
    basename="journal-entry",
)
path(
    "accounting/",
    include("finance.accounting_urls"),
),


urlpatterns = [
    path("", include(router.urls)),

    path(
        "reports/trial-balance/",
        TrialBalanceView.as_view(),
        name="trial-balance",
    ),
    path(
        "reports/general-ledger/",
        GeneralLedgerView.as_view(),
        name="general-ledger",
    ),
    path(
        "reports/income-statement/",
        IncomeStatementView.as_view(),
        name="income-statement",
    ),
    path(
        "reports/balance-sheet/",
        BalanceSheetView.as_view(),
        name="balance-sheet",
    ),
]
