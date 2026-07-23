from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from finance.models import AccountCategory, ChartOfAccount


CATEGORY_DATA = [
    {
        "code": "ASSET",
        "name": "Assets",
        "account_type": "asset",
        "normal_balance": "debit",
    },
    {
        "code": "LIABILITY",
        "name": "Liabilities",
        "account_type": "liability",
        "normal_balance": "credit",
    },
    {
        "code": "EQUITY",
        "name": "Equity",
        "account_type": "equity",
        "normal_balance": "credit",
    },
    {
        "code": "REVENUE",
        "name": "Operating Revenue",
        "account_type": "revenue",
        "normal_balance": "credit",
    },
    {
        "code": "COST_OF_SALES",
        "name": "Cost of Sales",
        "account_type": "expense",
        "normal_balance": "debit",
    },
    {
        "code": "EXPENSE",
        "name": "Operating Expenses",
        "account_type": "expense",
        "normal_balance": "debit",
    },
    {
        "code": "OTHER_INCOME",
        "name": "Other Income",
        "account_type": "revenue",
        "normal_balance": "credit",
    },
    {
        "code": "OTHER_EXPENSE",
        "name": "Other Expenses",
        "account_type": "expense",
        "normal_balance": "debit",
    },
]


ACCOUNT_DATA = [
    # ============================================================
    # ASSETS
    # ============================================================
    ("1000", "Cash on Hand", "ASSET"),
    ("1010", "Main Cash Till", "ASSET"),
    ("1020", "Reception Cash Till", "ASSET"),
    ("1030", "Pharmacy Cash Till", "ASSET"),
    ("1040", "Laboratory Cash Till", "ASSET"),
    ("1050", "Petty Cash", "ASSET"),
    ("1060", "Cash in Transit", "ASSET"),
    ("1100", "Main Bank Account", "ASSET"),
    ("1110", "Operating Bank Account", "ASSET"),
    ("1120", "Payroll Bank Account", "ASSET"),
    ("1130", "Savings Bank Account", "ASSET"),
    ("1140", "Mobile Money Account", "ASSET"),
    ("1150", "Card Settlement Account", "ASSET"),
    ("1200", "Accounts Receivable", "ASSET"),
    ("1210", "Patient Receivables", "ASSET"),
    ("1220", "Corporate Receivables", "ASSET"),
    ("1230", "Insurance Receivables", "ASSET"),
    ("1240", "Government Receivables", "ASSET"),
    ("1250", "Staff Receivables", "ASSET"),
    ("1260", "Other Receivables", "ASSET"),
    ("1270", "Allowance for Doubtful Accounts", "ASSET"),
    ("1300", "Pharmacy Inventory", "ASSET"),
    ("1310", "Medical Supplies Inventory", "ASSET"),
    ("1320", "Laboratory Reagents Inventory", "ASSET"),
    ("1330", "Laboratory Consumables Inventory", "ASSET"),
    ("1340", "Imaging Consumables Inventory", "ASSET"),
    ("1350", "Theatre Supplies Inventory", "ASSET"),
    ("1360", "Ward Supplies Inventory", "ASSET"),
    ("1370", "Dental Supplies Inventory", "ASSET"),
    ("1380", "General Stores Inventory", "ASSET"),
    ("1390", "Inventory in Transit", "ASSET"),
    ("1400", "Prepaid Expenses", "ASSET"),
    ("1410", "Prepaid Rent", "ASSET"),
    ("1420", "Prepaid Insurance", "ASSET"),
    ("1430", "Supplier Advances", "ASSET"),
    ("1440", "Employee Advances", "ASSET"),
    ("1450", "Security Deposits", "ASSET"),
    ("1500", "Land", "ASSET"),
    ("1510", "Buildings", "ASSET"),
    ("1520", "Medical Equipment", "ASSET"),
    ("1530", "Laboratory Equipment", "ASSET"),
    ("1540", "Imaging Equipment", "ASSET"),
    ("1550", "Theatre Equipment", "ASSET"),
    ("1560", "Ambulances", "ASSET"),
    ("1570", "Motor Vehicles", "ASSET"),
    ("1580", "Computers and IT Equipment", "ASSET"),
    ("1590", "Furniture and Fittings", "ASSET"),
    ("1600", "Office Equipment", "ASSET"),
    ("1610", "Leasehold Improvements", "ASSET"),
    ("1700", "Accumulated Depreciation - Buildings", "ASSET"),
    ("1710", "Accumulated Depreciation - Medical Equipment", "ASSET"),
    ("1720", "Accumulated Depreciation - Laboratory Equipment", "ASSET"),
    ("1730", "Accumulated Depreciation - Imaging Equipment", "ASSET"),
    ("1740", "Accumulated Depreciation - Vehicles", "ASSET"),
    ("1750", "Accumulated Depreciation - IT Equipment", "ASSET"),
    ("1760", "Accumulated Depreciation - Furniture", "ASSET"),

    # ============================================================
    # LIABILITIES
    # ============================================================
    ("2000", "Accounts Payable", "LIABILITY"),
    ("2010", "Pharmacy Suppliers Payable", "LIABILITY"),
    ("2020", "Medical Suppliers Payable", "LIABILITY"),
    ("2030", "Laboratory Suppliers Payable", "LIABILITY"),
    ("2040", "Other Suppliers Payable", "LIABILITY"),
    ("2100", "Accrued Expenses", "LIABILITY"),
    ("2110", "Salaries Payable", "LIABILITY"),
    ("2120", "Overtime Payable", "LIABILITY"),
    ("2130", "Staff Benefits Payable", "LIABILITY"),
    ("2140", "Utilities Payable", "LIABILITY"),
    ("2150", "Rent Payable", "LIABILITY"),
    ("2160", "Professional Fees Payable", "LIABILITY"),
    ("2200", "PAYE Tax Payable", "LIABILITY"),
    ("2210", "Social Security Payable", "LIABILITY"),
    ("2220", "Withholding Tax Payable", "LIABILITY"),
    ("2230", "VAT Payable", "LIABILITY"),
    ("2240", "Other Taxes Payable", "LIABILITY"),
    ("2300", "Patient Deposits", "LIABILITY"),
    ("2310", "Advance Patient Payments", "LIABILITY"),
    ("2320", "Corporate Customer Deposits", "LIABILITY"),
    ("2330", "Deferred Revenue", "LIABILITY"),
    ("2400", "Short-Term Loans", "LIABILITY"),
    ("2410", "Bank Overdraft", "LIABILITY"),
    ("2500", "Long-Term Loans", "LIABILITY"),
    ("2510", "Equipment Finance Liability", "LIABILITY"),
    ("2520", "Vehicle Finance Liability", "LIABILITY"),
    ("2600", "Insurance Claims Payable", "LIABILITY"),
    ("2610", "Refunds Payable", "LIABILITY"),
    ("2620", "Unclaimed Patient Balances", "LIABILITY"),

    # ============================================================
    # EQUITY
    # ============================================================
    ("3000", "Owner Capital", "EQUITY"),
    ("3010", "Share Capital", "EQUITY"),
    ("3020", "Additional Paid-In Capital", "EQUITY"),
    ("3100", "Retained Earnings", "EQUITY"),
    ("3110", "Current Year Earnings", "EQUITY"),
    ("3200", "Owner Drawings", "EQUITY"),
    ("3300", "Revaluation Reserve", "EQUITY"),

    # ============================================================
    # OPERATING REVENUE
    # ============================================================
    ("4000", "Consultation Revenue", "REVENUE"),
    ("4010", "General Consultation Revenue", "REVENUE"),
    ("4020", "Specialist Consultation Revenue", "REVENUE"),
    ("4030", "Emergency Consultation Revenue", "REVENUE"),
    ("4100", "Outpatient Revenue", "REVENUE"),
    ("4110", "Inpatient Admission Revenue", "REVENUE"),
    ("4120", "Ward and Bed Revenue", "REVENUE"),
    ("4130", "ICU Revenue", "REVENUE"),
    ("4140", "Nursing Service Revenue", "REVENUE"),
    ("4200", "Pharmacy Sales Revenue", "REVENUE"),
    ("4210", "Prescription Medicine Revenue", "REVENUE"),
    ("4220", "Over-the-Counter Medicine Revenue", "REVENUE"),
    ("4230", "Medical Supplies Sales Revenue", "REVENUE"),
    ("4300", "Laboratory Revenue", "REVENUE"),
    ("4310", "Hematology Revenue", "REVENUE"),
    ("4320", "Clinical Chemistry Revenue", "REVENUE"),
    ("4330", "Microbiology Revenue", "REVENUE"),
    ("4340", "Pathology Revenue", "REVENUE"),
    ("4350", "Blood Bank Revenue", "REVENUE"),
    ("4400", "Imaging Revenue", "REVENUE"),
    ("4410", "X-Ray Revenue", "REVENUE"),
    ("4420", "Ultrasound Revenue", "REVENUE"),
    ("4430", "CT Scan Revenue", "REVENUE"),
    ("4440", "MRI Revenue", "REVENUE"),
    ("4450", "ECG Revenue", "REVENUE"),
    ("4500", "Theatre Revenue", "REVENUE"),
    ("4510", "Surgery Revenue", "REVENUE"),
    ("4520", "Anaesthesia Revenue", "REVENUE"),
    ("4530", "Procedure Revenue", "REVENUE"),
    ("4600", "Maternity Revenue", "REVENUE"),
    ("4610", "Delivery Revenue", "REVENUE"),
    ("4620", "Antenatal Care Revenue", "REVENUE"),
    ("4630", "Postnatal Care Revenue", "REVENUE"),
    ("4700", "Dental Revenue", "REVENUE"),
    ("4710", "Physiotherapy Revenue", "REVENUE"),
    ("4720", "Vaccination Revenue", "REVENUE"),
    ("4730", "Dialysis Revenue", "REVENUE"),
    ("4740", "Ambulance Revenue", "REVENUE"),
    ("4750", "Medical Certificate Revenue", "REVENUE"),
    ("4800", "Insurance Service Revenue", "REVENUE"),
    ("4810", "Corporate Contract Revenue", "REVENUE"),
    ("4820", "Health Package Revenue", "REVENUE"),
    ("4900", "Registration Revenue", "REVENUE"),
    ("4910", "File and Card Revenue", "REVENUE"),

    # ============================================================
    # COST OF SALES
    # ============================================================
    ("5000", "Pharmacy Cost of Sales", "COST_OF_SALES"),
    ("5010", "Medical Supplies Cost of Sales", "COST_OF_SALES"),
    ("5020", "Laboratory Reagents Consumed", "COST_OF_SALES"),
    ("5030", "Laboratory Consumables Used", "COST_OF_SALES"),
    ("5040", "Imaging Consumables Used", "COST_OF_SALES"),
    ("5050", "Theatre Supplies Used", "COST_OF_SALES"),
    ("5060", "Ward Supplies Used", "COST_OF_SALES"),
    ("5070", "Dental Supplies Used", "COST_OF_SALES"),
    ("5080", "Inventory Write-Off Expense", "COST_OF_SALES"),
    ("5090", "Expired Medicines Expense", "COST_OF_SALES"),

    # ============================================================
    # OPERATING EXPENSES
    # ============================================================
    ("6000", "Salaries and Wages Expense", "EXPENSE"),
    ("6010", "Medical Staff Salaries", "EXPENSE"),
    ("6020", "Nursing Staff Salaries", "EXPENSE"),
    ("6030", "Administrative Staff Salaries", "EXPENSE"),
    ("6040", "Overtime Expense", "EXPENSE"),
    ("6050", "Staff Allowances", "EXPENSE"),
    ("6060", "Staff Benefits Expense", "EXPENSE"),
    ("6070", "Staff Training Expense", "EXPENSE"),
    ("6080", "Recruitment Expense", "EXPENSE"),
    ("6100", "Rent Expense", "EXPENSE"),
    ("6110", "Electricity Expense", "EXPENSE"),
    ("6120", "Water Expense", "EXPENSE"),
    ("6130", "Internet Expense", "EXPENSE"),
    ("6140", "Telephone Expense", "EXPENSE"),
    ("6150", "Generator Fuel Expense", "EXPENSE"),
    ("6160", "Vehicle Fuel Expense", "EXPENSE"),
    ("6170", "Waste Disposal Expense", "EXPENSE"),
    ("6180", "Cleaning Expense", "EXPENSE"),
    ("6190", "Security Expense", "EXPENSE"),
    ("6200", "Repairs and Maintenance", "EXPENSE"),
    ("6210", "Medical Equipment Maintenance", "EXPENSE"),
    ("6220", "Laboratory Equipment Maintenance", "EXPENSE"),
    ("6230", "Imaging Equipment Maintenance", "EXPENSE"),
    ("6240", "Building Maintenance", "EXPENSE"),
    ("6250", "Vehicle Maintenance", "EXPENSE"),
    ("6260", "IT Support and Maintenance", "EXPENSE"),
    ("6300", "Office Supplies Expense", "EXPENSE"),
    ("6310", "Printing and Stationery", "EXPENSE"),
    ("6320", "Software Subscription Expense", "EXPENSE"),
    ("6330", "Licensing and Registration Fees", "EXPENSE"),
    ("6340", "Professional Fees", "EXPENSE"),
    ("6350", "Legal Fees", "EXPENSE"),
    ("6360", "Audit Fees", "EXPENSE"),
    ("6370", "Consultancy Fees", "EXPENSE"),
    ("6400", "Insurance Expense", "EXPENSE"),
    ("6410", "Medical Malpractice Insurance", "EXPENSE"),
    ("6420", "Vehicle Insurance Expense", "EXPENSE"),
    ("6430", "Property Insurance Expense", "EXPENSE"),
    ("6500", "Marketing and Advertising Expense", "EXPENSE"),
    ("6510", "Public Relations Expense", "EXPENSE"),
    ("6520", "Community Outreach Expense", "EXPENSE"),
    ("6600", "Travel Expense", "EXPENSE"),
    ("6610", "Accommodation Expense", "EXPENSE"),
    ("6620", "Meals and Entertainment Expense", "EXPENSE"),
    ("6700", "Bank Charges", "EXPENSE"),
    ("6710", "Mobile Money Charges", "EXPENSE"),
    ("6720", "Card Processing Fees", "EXPENSE"),
    ("6730", "Bad Debt Expense", "EXPENSE"),
    ("6800", "Depreciation - Buildings", "EXPENSE"),
    ("6810", "Depreciation - Medical Equipment", "EXPENSE"),
    ("6820", "Depreciation - Laboratory Equipment", "EXPENSE"),
    ("6830", "Depreciation - Imaging Equipment", "EXPENSE"),
    ("6840", "Depreciation - Vehicles", "EXPENSE"),
    ("6850", "Depreciation - IT Equipment", "EXPENSE"),
    ("6860", "Depreciation - Furniture", "EXPENSE"),
    ("6900", "Donations and Welfare Expense", "EXPENSE"),
    ("6910", "Penalties and Fines", "EXPENSE"),
    ("6990", "Miscellaneous Expense", "EXPENSE"),

    # ============================================================
    # OTHER INCOME
    # ============================================================
    ("8000", "Interest Income", "OTHER_INCOME"),
    ("8010", "Foreign Exchange Gain", "OTHER_INCOME"),
    ("8020", "Gain on Asset Disposal", "OTHER_INCOME"),
    ("8030", "Rental Income", "OTHER_INCOME"),
    ("8040", "Donations and Grants Income", "OTHER_INCOME"),
    ("8050", "Miscellaneous Income", "OTHER_INCOME"),

    # ============================================================
    # OTHER EXPENSES
    # ============================================================
    ("9000", "Interest Expense", "OTHER_EXPENSE"),
    ("9010", "Foreign Exchange Loss", "OTHER_EXPENSE"),
    ("9020", "Loss on Asset Disposal", "OTHER_EXPENSE"),
    ("9030", "Loan Processing Fees", "OTHER_EXPENSE"),
    ("9040", "Prior Period Adjustment Expense", "OTHER_EXPENSE"),
]


class Command(BaseCommand):
    help = "Seed the default hospital Chart of Accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hospital-id",
            type=int,
            help="Seed only the hospital with this ID.",
        )

        parser.add_argument(
            "--reset-names",
            action="store_true",
            help="Update names and categories of existing accounts.",
        )

    @staticmethod
    def model_has_field(model, field_name):
        return any(
            field.name == field_name
            for field in model._meta.get_fields()
        )

    @staticmethod
    def resolve_choice_value(model, field_name, requested_value):
        """
        Match a choice using either its stored value or display label.
        """

        try:
            field = model._meta.get_field(field_name)
        except Exception:
            return requested_value

        choices = list(field.flatchoices)

        if not choices:
            return requested_value

        requested = str(requested_value).strip().lower()

        for value, label in choices:
            if str(value).strip().lower() == requested:
                return value

            if str(label).strip().lower() == requested:
                return value

        aliases = {
            "asset": ["assets"],
            "liability": ["liabilities"],
            "equity": ["capital"],
            "revenue": ["income", "sales"],
            "expense": ["expenses", "cost"],
            "debit": ["dr"],
            "credit": ["cr"],
        }

        for canonical, alternatives in aliases.items():
            if requested == canonical:
                for value, label in choices:
                    choice_text = (
                        f"{value} {label}"
                    ).strip().lower()

                    if any(
                        alternative in choice_text
                        for alternative in alternatives
                    ):
                        return value

        available = ", ".join(
            f"{value} ({label})"
            for value, label in choices
        )

        raise CommandError(
            f"Could not map '{requested_value}' to "
            f"{model.__name__}.{field_name}. "
            f"Available choices: {available}"
        )

    def get_hospital_model(self):
        try:
            hospital_field = AccountCategory._meta.get_field(
                "hospital"
            )
        except Exception as exc:
            raise CommandError(
                "AccountCategory must contain a hospital field."
            ) from exc

        return hospital_field.remote_field.model

    def category_defaults(self, category_data):
        defaults = {
            "name": category_data["name"],
        }

        if self.model_has_field(
            AccountCategory,
            "account_type",
        ):
            defaults["account_type"] = self.resolve_choice_value(
                AccountCategory,
                "account_type",
                category_data["account_type"],
            )

        if self.model_has_field(
            AccountCategory,
            "normal_balance",
        ):
            defaults["normal_balance"] = self.resolve_choice_value(
                AccountCategory,
                "normal_balance",
                category_data["normal_balance"],
            )

        if self.model_has_field(
            AccountCategory,
            "is_active",
        ):
            defaults["is_active"] = True

        return defaults

    def account_defaults(
        self,
        *,
        name,
        category,
        update_existing,
    ):
        defaults = {}

        if update_existing:
            defaults["name"] = name
            defaults["category"] = category
        else:
            defaults.update(
                {
                    "name": name,
                    "category": category,
                }
            )

        if self.model_has_field(
            ChartOfAccount,
            "description",
        ):
            defaults["description"] = (
                f"Default hospital account: {name}"
            )

        if self.model_has_field(
            ChartOfAccount,
            "is_active",
        ):
            defaults["is_active"] = True

        if self.model_has_field(
            ChartOfAccount,
            "allow_manual_posting",
        ):
            defaults["allow_manual_posting"] = True

        if self.model_has_field(
            ChartOfAccount,
            "is_system_account",
        ):
            defaults["is_system_account"] = True

        return defaults

    @transaction.atomic
    def seed_hospital(self, hospital, reset_names=False):
        category_map = {}

        categories_created = 0
        categories_updated = 0
        accounts_created = 0
        accounts_updated = 0
        accounts_skipped = 0

        category_aliases = {
            "ASSET": [
                "Assets",
                "Current Assets",
            ],
            "LIABILITY": [
                "Liabilities",
                "Current Liabilities",
            ],
            "EQUITY": [
                "Equity",
            ],
            "REVENUE": [
                "Operating Revenue",
                "Hospital Revenue",
                "Revenue",
            ],
            "COST_OF_SALES": [
                "Cost of Sales",
            ],
            "EXPENSE": [
                "Operating Expenses",
                "Expenses",
            ],
            "OTHER_INCOME": [
                "Other Income",
            ],
            "OTHER_EXPENSE": [
                "Other Expenses",
            ],
        }

        for category_data in CATEGORY_DATA:
            category = AccountCategory.objects.filter(
                hospital=hospital,
                code=category_data["code"],
            ).first()

            created = False

            if category is None:
                aliases = category_aliases.get(
                    category_data["code"],
                    [category_data["name"]],
                )

                category = AccountCategory.objects.filter(
                    hospital=hospital,
                    name__in=aliases,
                ).first()

            if category is None:
                category = AccountCategory.objects.create(
                    hospital=hospital,
                    code=category_data["code"],
                    **self.category_defaults(category_data),
                )
                created = True

            if created:
                categories_created += 1

            elif reset_names:
                changed_fields = []
                expected_defaults = self.category_defaults(
                    category_data
                )

                # Preserve existing names and codes because they may
                # already be used by existing accounts and reports.
                expected_defaults.pop("name", None)

                for field_name, expected_value in (
                    expected_defaults.items()
                ):
                    if (
                        getattr(category, field_name)
                        != expected_value
                    ):
                        setattr(
                            category,
                            field_name,
                            expected_value,
                        )
                        changed_fields.append(field_name)

                if changed_fields:
                    category.save(
                        update_fields=changed_fields
                    )
                    categories_updated += 1

            category_map[category_data["code"]] = category

        for code, name, category_code in ACCOUNT_DATA:
            category = category_map[category_code]

            # First search using the account code.
            existing = ChartOfAccount.objects.filter(
                hospital=hospital,
                code=code,
            ).first()

            # The model also enforces hospital + name uniqueness.
            # Therefore, search by name before creating a new account.
            if existing is None:
                existing = ChartOfAccount.objects.filter(
                    hospital=hospital,
                    name__iexact=name,
                ).first()

            if existing:
                if reset_names:
                    defaults = self.account_defaults(
                        name=name,
                        category=category,
                        update_existing=True,
                    )

                    changed_fields = []

                    # Keep an existing code when the account was matched
                    # by name. This avoids changing codes already used by
                    # journals, reports, or integrations.
                    if existing.code == code:
                        defaults["code"] = code

                    for field_name, expected_value in defaults.items():
                        if not hasattr(existing, field_name):
                            continue

                        if getattr(existing, field_name) != expected_value:
                            setattr(
                                existing,
                                field_name,
                                expected_value,
                            )
                            changed_fields.append(field_name)

                    if changed_fields:
                        existing.save(
                            update_fields=changed_fields
                        )
                        accounts_updated += 1
                    else:
                        accounts_skipped += 1
                else:
                    accounts_skipped += 1

                continue

            defaults = self.account_defaults(
                name=name,
                category=category,
                update_existing=False,
            )

            ChartOfAccount.objects.create(
                hospital=hospital,
                code=code,
                **defaults,
            )

            accounts_created += 1

        return {
            "categories_created": categories_created,
            "categories_updated": categories_updated,
            "accounts_created": accounts_created,
            "accounts_updated": accounts_updated,
            "accounts_skipped": accounts_skipped,
        }

    def handle(self, *args, **options):
        Hospital = self.get_hospital_model()

        hospitals = Hospital.objects.all()

        hospital_id = options.get("hospital_id")

        if hospital_id:
            hospitals = hospitals.filter(pk=hospital_id)

        if not hospitals.exists():
            raise CommandError(
                "No hospitals were found. Create a hospital first."
            )

        reset_names = options["reset_names"]

        total_accounts_created = 0
        total_accounts_updated = 0
        total_accounts_skipped = 0

        for hospital in hospitals:
            self.stdout.write("")
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"Seeding Chart of Accounts for: {hospital}"
                )
            )

            results = self.seed_hospital(
                hospital,
                reset_names=reset_names,
            )

            total_accounts_created += (
                results["accounts_created"]
            )
            total_accounts_updated += (
                results["accounts_updated"]
            )
            total_accounts_skipped += (
                results["accounts_skipped"]
            )

            self.stdout.write(
                self.style.SUCCESS(
                    "Categories created: "
                    f"{results['categories_created']}"
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    "Categories updated: "
                    f"{results['categories_updated']}"
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    "Accounts created: "
                    f"{results['accounts_created']}"
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    "Accounts updated: "
                    f"{results['accounts_updated']}"
                )
            )
            self.stdout.write(
                f"Existing accounts skipped: "
                f"{results['accounts_skipped']}"
            )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "Chart of Accounts seeding completed."
            )
        )
        self.stdout.write(
            f"Total accounts created: "
            f"{total_accounts_created}"
        )
        self.stdout.write(
            f"Total accounts updated: "
            f"{total_accounts_updated}"
        )
        self.stdout.write(
            f"Total accounts skipped: "
            f"{total_accounts_skipped}"
        )
