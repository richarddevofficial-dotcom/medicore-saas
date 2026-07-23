from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Iterable

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
)

User = get_user_model()

ZERO = Decimal("0.00")


@dataclass(frozen=True)
class JournalLineData:
    """
    Represents one debit or credit journal line.
    """

    account: ChartOfAccount | None = None
    account_code: str | None = None
    description: str = ""
    debit: Decimal = ZERO
    credit: Decimal = ZERO


def to_decimal(value) -> Decimal:
    """
    Convert a value to a two-decimal Decimal.
    """

    if value in (None, ""):
        return ZERO

    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(
            f"Invalid monetary amount: {value}"
        ) from exc


def get_account(
    *,
    hospital,
    account_code: str,
    require_active: bool = True,
) -> ChartOfAccount:
    """
    Return a Chart of Account using its hospital and account code.
    """

    if not hospital:
        raise ValidationError("Hospital is required.")

    if not account_code or not account_code.strip():
        raise ValidationError("Account code is required.")

    filters = {
        "hospital": hospital,
        "code": account_code.strip(),
    }

    if require_active:
        filters["is_active"] = True

    try:
        return ChartOfAccount.objects.get(**filters)
    except ChartOfAccount.DoesNotExist as exc:
        raise ValidationError(
            f"Account {account_code} was not found for this hospital."
        ) from exc
    except ChartOfAccount.MultipleObjectsReturned as exc:
        raise ValidationError(
            f"Multiple accounts use code {account_code}."
        ) from exc


def resolve_account(
    *,
    hospital,
    line: JournalLineData,
) -> ChartOfAccount:
    """
    Resolve the account supplied directly or through account_code.
    """

    if line.account is not None:
        account = line.account

        if account.hospital_id != hospital.id:
            raise ValidationError(
                f"Account {account.code} belongs to another hospital."
            )

        if not account.is_active:
            raise ValidationError(
                f"Account {account.code} is inactive."
            )

        return account

    if line.account_code:
        return get_account(
            hospital=hospital,
            account_code=line.account_code,
        )

    raise ValidationError(
        "Each journal line requires an account or account_code."
    )


def validate_journal_lines(
    *,
    hospital,
    lines: Iterable[JournalLineData],
) -> list[dict]:
    """
    Validate and normalize journal entry lines.
    """

    normalized_lines = []
    total_debit = ZERO
    total_credit = ZERO

    for position, line in enumerate(lines, start=1):
        if not isinstance(line, JournalLineData):
            raise ValidationError(
                f"Line {position} must be a JournalLineData instance."
            )

        account = resolve_account(
            hospital=hospital,
            line=line,
        )

        debit = to_decimal(line.debit)
        credit = to_decimal(line.credit)

        if debit < ZERO:
            raise ValidationError(
                f"Line {position}: debit cannot be negative."
            )

        if credit < ZERO:
            raise ValidationError(
                f"Line {position}: credit cannot be negative."
            )

        if debit == ZERO and credit == ZERO:
            raise ValidationError(
                f"Line {position}: enter either debit or credit."
            )

        if debit > ZERO and credit > ZERO:
            raise ValidationError(
                f"Line {position}: debit and credit cannot both be entered."
            )

        normalized_lines.append(
            {
                "account": account,
                "description": line.description.strip(),
                "debit": debit,
                "credit": credit,
            }
        )

        total_debit += debit
        total_credit += credit

    if len(normalized_lines) < 2:
        raise ValidationError(
            "A journal entry must contain at least two lines."
        )

    if total_debit <= ZERO:
        raise ValidationError(
            "Journal total must be greater than zero."
        )

    if total_debit != total_credit:
        raise ValidationError(
            {
                "lines": (
                    "Journal entry is not balanced. "
                    f"Debit: {total_debit}, "
                    f"Credit: {total_credit}."
                )
            }
        )

    return normalized_lines


@transaction.atomic
def create_journal_entry(
    *,
    hospital,
    description: str,
    lines: Iterable[JournalLineData],
    user: User | None = None,
    entry_date: date | None = None,
    entry_type: str = JournalEntry.EntryType.GENERAL,
    reference: str = "",
    source_module: str = "",
    source_id: str = "",
    post_immediately: bool = False,
) -> JournalEntry:
    """
    Create a balanced journal entry.

    The journal remains in draft unless post_immediately=True.
    """

    if not hospital:
        raise ValidationError("Hospital is required.")

    if not description or not description.strip():
        raise ValidationError("Journal description is required.")

    normalized_lines = validate_journal_lines(
        hospital=hospital,
        lines=list(lines),
    )

    if source_module and source_id:
        existing_entry = JournalEntry.objects.filter(
            hospital=hospital,
            source_module=source_module,
            source_id=str(source_id),
        ).exclude(
            status=JournalEntry.Status.VOID
        ).first()

        if existing_entry:
            raise ValidationError(
                "A journal entry already exists for this source transaction."
            )

    journal_entry = JournalEntry(
        hospital=hospital,
        entry_date=entry_date or timezone.localdate(),
        entry_type=entry_type,
        reference=reference.strip(),
        description=description.strip(),
        source_module=source_module.strip(),
        source_id=str(source_id).strip(),
        created_by=user,
    )

    journal_entry.full_clean(
        exclude=["journal_number"]
    )
    journal_entry.save()

    line_objects = []

    for line in normalized_lines:
        line_objects.append(
            JournalEntryLine(
                journal_entry=journal_entry,
                account=line["account"],
                description=line["description"],
                debit=line["debit"],
                credit=line["credit"],
            )
        )

    for line_object in line_objects:
        line_object.full_clean()
        line_object.save()

    if post_immediately:
        journal_entry = journal_entry.post(user=user)

    return journal_entry


@transaction.atomic
def post_journal_entry(
    *,
    journal_entry: JournalEntry,
    user: User | None = None,
) -> JournalEntry:
    """
    Post an existing draft journal entry.
    """

    if not journal_entry.pk:
        raise ValidationError(
            "Journal entry must be saved before posting."
        )

    journal_entry = (
        JournalEntry.objects
        .select_for_update()
        .get(pk=journal_entry.pk)
    )

    return journal_entry.post(user=user)


@transaction.atomic
def void_journal_entry(
    *,
    journal_entry: JournalEntry,
    reason: str,
    user: User | None = None,
) -> JournalEntry:
    """
    Void an existing posted journal entry.
    """

    if not journal_entry.pk:
        raise ValidationError(
            "Journal entry must be saved before voiding."
        )

    journal_entry = (
        JournalEntry.objects
        .select_for_update()
        .get(pk=journal_entry.pk)
    )

    return journal_entry.void(
        user=user,
        reason=reason,
    )


@transaction.atomic
def reverse_journal_entry(
    *,
    journal_entry: JournalEntry,
    user: User | None = None,
    reversal_date: date | None = None,
    reason: str = "",
    void_original: bool = False,
) -> JournalEntry:
    """
    Create a reversing journal entry.

    Every debit becomes a credit and every credit becomes a debit.
    """

    if not journal_entry.pk:
        raise ValidationError(
            "Journal entry must be saved before reversal."
        )

    original = (
        JournalEntry.objects
        .select_for_update()
        .prefetch_related("lines__account")
        .get(pk=journal_entry.pk)
    )

    if original.status != JournalEntry.Status.POSTED:
        raise ValidationError(
            "Only posted journal entries can be reversed."
        )

    reversal_reason = reason.strip()

    if not reversal_reason:
        reversal_reason = (
            f"Reversal of journal {original.journal_number}"
        )

    reversal_lines = [
        JournalLineData(
            account=line.account,
            description=(
                line.description
                or f"Reversal of {original.journal_number}"
            ),
            debit=line.credit,
            credit=line.debit,
        )
        for line in original.lines.all()
    ]

    reversal_entry = create_journal_entry(
        hospital=original.hospital,
        description=reversal_reason,
        lines=reversal_lines,
        user=user,
        entry_date=reversal_date or timezone.localdate(),
        entry_type=JournalEntry.EntryType.ADJUSTMENT,
        reference=original.journal_number,
        source_module="journal_reversal",
        source_id=str(original.pk),
        post_immediately=True,
    )

    if void_original:
        original.void(
            user=user,
            reason=(
                f"Reversed by journal "
                f"{reversal_entry.journal_number}. "
                f"{reversal_reason}"
            ),
        )

    return reversal_entry


@transaction.atomic
def post_simple_transaction(
    *,
    hospital,
    debit_account_code: str,
    credit_account_code: str,
    amount,
    description: str,
    user: User | None = None,
    entry_date: date | None = None,
    entry_type: str = JournalEntry.EntryType.GENERAL,
    reference: str = "",
    source_module: str = "",
    source_id: str = "",
) -> JournalEntry:
    """
    Post a basic two-line accounting transaction.
    """

    transaction_amount = to_decimal(amount)

    if transaction_amount <= ZERO:
        raise ValidationError(
            "Transaction amount must be greater than zero."
        )

    return create_journal_entry(
        hospital=hospital,
        description=description,
        lines=[
            JournalLineData(
                account_code=debit_account_code,
                description=description,
                debit=transaction_amount,
            ),
            JournalLineData(
                account_code=credit_account_code,
                description=description,
                credit=transaction_amount,
            ),
        ],
        user=user,
        entry_date=entry_date,
        entry_type=entry_type,
        reference=reference,
        source_module=source_module,
        source_id=source_id,
        post_immediately=True,
    )
