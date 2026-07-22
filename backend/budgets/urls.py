from django.urls import path, include
from rest_framework.routers import DefaultRouter
from budgets import views

router = DefaultRouter()
router.register(r'years', views.BudgetYearViewSet, basename='budget-year')
router.register(r'templates', views.BudgetTemplateViewSet, basename='budget-template')
router.register(r'allocations', views.BudgetAllocationViewSet, basename='budget-allocation')
router.register(r'variances', views.BudgetVarianceViewSet, basename='budget-variance')
router.register(r'revisions', views.BudgetRevisionViewSet, basename='budget-revision')
router.register(r'forecasts', views.BudgetForecastViewSet, basename='budget-forecast')
router.register(r'alerts', views.BudgetAlertViewSet, basename='budget-alert')

urlpatterns = [
    path('', include(router.urls)),
]
