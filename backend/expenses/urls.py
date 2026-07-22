from django.urls import path, include
from rest_framework.routers import DefaultRouter
from expenses.views import (
    ExpenseCategoryViewSet, ExpenseViewSet,
    ExpenseBudgetViewSet, ExpensePaymentViewSet
)

router = DefaultRouter()
router.register(r'categories', ExpenseCategoryViewSet, basename='expense-category')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'budgets', ExpenseBudgetViewSet, basename='expense-budget')
router.register(r'payments', ExpensePaymentViewSet, basename='expense-payment')

urlpatterns = [
    path('', include(router.urls)),
]
