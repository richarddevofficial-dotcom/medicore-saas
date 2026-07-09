export function printInvoice(bill) {
  const taxRate = bill.tax || 18;
  const subtotal = bill.subtotal || bill.consult + bill.lab + bill.medicine;
  const tax = subtotal * (taxRate / 100);
  const total = bill.total || subtotal + tax;
  const formatCurrency = (value) => {
    const amount = Number.parseFloat(value ?? 0);
    return `SSP ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  };

  const printWindow = window.open("", "_blank", "width=800,height=600");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${bill.bill}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #F97316; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #1E3A5F; margin: 0; }
        .header p { color: #666; margin: 5px 0; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info-box { flex: 1; }
        .info-box h3 { color: #F97316; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #1E3A5F; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        .total-row { font-weight: bold; font-size: 1.1em; }
        .footer { text-align: center; margin-top: 40px; color: #666; font-size: 0.9em; border-top: 1px solid #ddd; padding-top: 20px; }
        .amount-words { margin: 10px 0; font-style: italic; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>MediCore HMS</h1>
        <p>Alliance Medical Centre | 123 Main Street, Mumbai</p>
        <p>Phone: +919876543210 | Email: alliance@hospital.com</p>
      </div>

      <div class="invoice-info">
        <div class="info-box">
          <h3>Invoice To:</h3>
          <p><strong>${bill.patient}</strong></p>
          <p>Date: ${bill.date || new Date().toLocaleDateString()}</p>
        </div>
        <div class="info-box" style="text-align:right;">
          <h3>Invoice Details:</h3>
          <p>Invoice #: <strong>${bill.bill}</strong></p>
          <p>Status: <strong style="color:${bill.status === "paid" ? "green" : "red"}">${bill.status?.toUpperCase()}</strong></p>
          ${bill.type === "insurance" ? `<p>Insurance: ${bill.insurance}</p>` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right;">Amount (SSP)</th>
          </tr>
        </thead>
        <tbody>
          ${bill.consult > 0 ? `<tr><td>Consultation Fee</td><td style="text-align:right;">${formatCurrency(bill.consult)}</td></tr>` : ""}
          ${bill.lab > 0 ? `<tr><td>Laboratory Fee</td><td style="text-align:right;">${formatCurrency(bill.lab)}</td></tr>` : ""}
          ${bill.medicine > 0 ? `<tr><td>Medicine Fee</td><td style="text-align:right;">${formatCurrency(bill.medicine)}</td></tr>` : ""}
          <tr><td>Subtotal</td><td style="text-align:right;">${formatCurrency(subtotal)}</td></tr>
          <tr><td>Tax (GST ${taxRate}%)</td><td style="text-align:right;">${formatCurrency(tax)}</td></tr>
          <tr class="total-row"><td>TOTAL</td><td style="text-align:right; font-size:1.2em; color:#F97316;">${formatCurrency(total)}</td></tr>
          ${bill.paid > 0 ? `<tr><td>Amount Paid</td><td style="text-align:right; color:green;">${formatCurrency(bill.paid)}</td></tr>` : ""}
          ${bill.balance > 0 ? `<tr style="color:red;"><td>Balance Due</td><td style="text-align:right;">${formatCurrency(bill.balance)}</td></tr>` : ""}
        </tbody>
      </table>

      <div class="footer">
        <p>Thank you for choosing MediCore!</p>
        <p>This is a computer-generated invoice.</p>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
