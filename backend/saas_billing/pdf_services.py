from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


PAGE_WIDTH, PAGE_HEIGHT = A4


def money(amount, currency="USD"):
    return f"{currency} {amount:,.2f}"


def base_styles():
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="DocumentTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0F172A"),
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )

    styles.add(
        ParagraphStyle(
            name="SmallMuted",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#64748B"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="RightText",
            parent=styles["Normal"],
            alignment=TA_RIGHT,
            fontSize=9,
            leading=12,
        )
    )

    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#0F172A"),
            spaceBefore=8,
            spaceAfter=6,
        )
    )

    return styles


def document_header(styles, document_type, document_number):
    return [
        Paragraph("MediCore HMS", styles["DocumentTitle"]),
        Paragraph(
            "Cloud Hospital Management Platform",
            styles["SmallMuted"],
        ),
        Spacer(1, 5 * mm),
        Table(
            [
                [
                    Paragraph(
                        f"<b>{document_type}</b>",
                        styles["Heading2"],
                    ),
                    Paragraph(
                        f"<b>{document_number}</b>",
                        styles["RightText"],
                    ),
                ]
            ],
            colWidths=[90 * mm, 90 * mm],
        ),
        Spacer(1, 5 * mm),
    ]


def footer(canvas, document):
    canvas.saveState()

    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.line(
        20 * mm,
        15 * mm,
        PAGE_WIDTH - 20 * mm,
        15 * mm,
    )

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))

    canvas.drawString(
        20 * mm,
        10 * mm,
        "MediCore HMS | support@medicorecloud.com",
    )

    canvas.drawRightString(
        PAGE_WIDTH - 20 * mm,
        10 * mm,
        f"Page {document.page}",
    )

    canvas.restoreState()


def build_invoice_pdf(invoice):
    buffer = BytesIO()
    styles = base_styles()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=22 * mm,
        title=f"Invoice {invoice.invoice_number}",
        author="MediCore HMS",
    )

    hospital = invoice.hospital
    subscription = invoice.subscription
    plan = subscription.plan

    story = document_header(
        styles,
        "INVOICE",
        invoice.invoice_number,
    )

    hospital_data = [
        [
            Paragraph(
                "<b>Bill To</b>",
                styles["SectionHeading"],
            ),
            Paragraph(
                "<b>Invoice Details</b>",
                styles["SectionHeading"],
            ),
        ],
        [
            Paragraph(
                (
                    f"<b>{hospital.name}</b><br/>"
                    f"{hospital.email or ''}<br/>"
                    f"{hospital.phone or ''}<br/>"
                    f"{hospital.address or ''}<br/>"
                    f"{hospital.city or ''}, {hospital.country or ''}"
                ),
                styles["Normal"],
            ),
            Paragraph(
                (
                    f"<b>Issued:</b> "
                    f"{invoice.issued_at.strftime('%d %B %Y')}<br/>"
                    f"<b>Due:</b> "
                    f"{invoice.due_date.strftime('%d %B %Y')}<br/>"
                    f"<b>Plan:</b> {plan.name}<br/>"
                    f"<b>Status:</b> {invoice.get_status_display()}<br/>"
                    f"<b>Currency:</b> {invoice.currency}"
                ),
                styles["Normal"],
            ),
        ],
    ]

    hospital_table = Table(
        hospital_data,
        colWidths=[90 * mm, 90 * mm],
        hAlign="LEFT",
    )

    hospital_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#F8FAFC"),
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor("#CBD5E1"),
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor("#E2E8F0"),
                ),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    story.append(hospital_table)
    story.append(Spacer(1, 8 * mm))
    story.append(
        Paragraph(
            "Invoice Items",
            styles["SectionHeading"],
        )
    )

    item_rows = [
        [
            "Description",
            "Quantity",
            "Unit Price",
            "Amount",
        ]
    ]

    if invoice.service_fee_amount > 0:
        item_rows.append(
            [
                "One-time Platform Service Fee",
                "1",
                money(
                    invoice.service_fee_amount,
                    invoice.currency,
                ),
                money(
                    invoice.service_fee_amount,
                    invoice.currency,
                ),
            ]
        )

    if invoice.subscription_amount > 0:
        item_rows.append(
            [
                f"{plan.name} Monthly Software Subscription",
                "1",
                money(
                    invoice.subscription_amount,
                    invoice.currency,
                ),
                money(
                    invoice.subscription_amount,
                    invoice.currency,
                ),
            ]
        )

    if invoice.adjustment_amount != 0:
        item_rows.append(
            [
                "Adjustment",
                "1",
                money(
                    invoice.adjustment_amount,
                    invoice.currency,
                ),
                money(
                    invoice.adjustment_amount,
                    invoice.currency,
                ),
            ]
        )

    items_table = Table(
        item_rows,
        colWidths=[
            90 * mm,
            20 * mm,
            35 * mm,
            35 * mm,
        ],
        repeatRows=1,
    )

    items_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#0F172A"),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
                (
                    "ALIGN",
                    (1, 1),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor("#CBD5E1"),
                ),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    total_rows = [
        [
            "Subtotal",
            money(invoice.subtotal, invoice.currency),
        ],
        [
            "Tax",
            money(invoice.tax_amount, invoice.currency),
        ],
        [
            "Total",
            money(invoice.total_amount, invoice.currency),
        ],
        [
            "Amount Paid",
            money(invoice.amount_paid, invoice.currency),
        ],
        [
            "Balance Due",
            money(invoice.balance_due, invoice.currency),
        ],
    ]

    total_table = Table(
        total_rows,
        colWidths=[45 * mm, 45 * mm],
        hAlign="RIGHT",
    )

    total_table.setStyle(
        TableStyle(
            [
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "Helvetica-Bold",
                ),
                (
                    "LINEABOVE",
                    (0, 2),
                    (-1, 2),
                    1,
                    colors.HexColor("#0F172A"),
                ),
                (
                    "BACKGROUND",
                    (0, 4),
                    (-1, 4),
                    colors.HexColor("#FFF7ED"),
                ),
                (
                    "FONTNAME",
                    (0, 4),
                    (-1, 4),
                    "Helvetica-Bold",
                ),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    story.append(total_table)
    story.append(Spacer(1, 8 * mm))

    if invoice.description:
        story.append(
            Paragraph(
                "Notes",
                styles["SectionHeading"],
            )
        )
        story.append(
            Paragraph(
                invoice.description,
                styles["Normal"],
            )
        )

    story.append(Spacer(1, 6 * mm))

    story.append(
        Paragraph(
            (
                "Payment instructions: submit your payment through "
                "the MediCore Billing Portal and include the invoice "
                f"number {invoice.invoice_number} as the reference."
            ),
            styles["SmallMuted"],
        )
    )

    document.build(
        story,
        onFirstPage=footer,
        onLaterPages=footer,
    )

    buffer.seek(0)
    return buffer


def build_payment_receipt_pdf(payment):
    buffer = BytesIO()
    styles = base_styles()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=22 * mm,
        title=f"Receipt {payment.payment_reference}",
        author="MediCore HMS",
    )

    hospital = payment.hospital
    invoice = payment.invoice

    story = document_header(
        styles,
        "PAYMENT RECEIPT",
        payment.payment_reference,
    )

    if payment.status == payment.STATUS_SUCCESS:
        status_message = "PAYMENT RECEIVED"
        status_color = colors.HexColor("#15803D")
        status_background = colors.HexColor("#DCFCE7")
    else:
        status_message = payment.get_status_display().upper()
        status_color = colors.HexColor("#B45309")
        status_background = colors.HexColor("#FEF3C7")

    status_table = Table(
        [[status_message]],
        colWidths=[180 * mm],
    )

    status_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    status_background,
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, -1),
                    status_color,
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "CENTER",
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, -1),
                    "Helvetica-Bold",
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    13,
                ),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )

    story.append(status_table)
    story.append(Spacer(1, 8 * mm))

    receipt_rows = [
        ["Hospital", hospital.name],
        ["Hospital Email", hospital.email or "Not available"],
        ["Invoice Number", invoice.invoice_number],
        ["Payment Reference", payment.payment_reference],
        ["Transaction Reference", payment.transaction_id or "Not available"],
        ["Payment Method", payment.payment_method or payment.gateway],
        ["Payment Type", payment.get_payment_type_display()],
        ["Amount", money(payment.amount, payment.currency)],
        ["Currency", payment.currency],
        ["Status", payment.get_status_display()],
        [
            "Payment Date",
            (
                payment.paid_at.strftime("%d %B %Y %H:%M")
                if payment.paid_at
                else payment.created_at.strftime(
                    "%d %B %Y %H:%M"
                )
            ),
        ],
    ]

    receipt_table = Table(
        receipt_rows,
        colWidths=[60 * mm, 120 * mm],
    )

    receipt_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (0, -1),
                    colors.HexColor("#F8FAFC"),
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "Helvetica-Bold",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor("#CBD5E1"),
                ),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    story.append(receipt_table)
    story.append(Spacer(1, 8 * mm))

    story.append(
        Paragraph(
            (
                "This document confirms that MediCore HMS recorded "
                "the payment shown above. Keep this receipt for your "
                "hospital's financial records."
            ),
            styles["SmallMuted"],
        )
    )

    document.build(
        story,
        onFirstPage=footer,
        onLaterPages=footer,
    )

    buffer.seek(0)
    return buffer
