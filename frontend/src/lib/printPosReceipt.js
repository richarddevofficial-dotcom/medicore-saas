export function printPosReceipt(receipt) {
  const formatCurrency = (value) => {
    const amount = Number.parseFloat(value ?? 0);
    return `SSP ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  };

  const printWindow = window.open("", "_blank", "width=480,height=720");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>POS Receipt ${receipt.receiptNo}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #222; margin: 0; padding: 20px; }
        .wrapper { max-width: 360px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px dashed #ddd; padding-bottom: 12px; margin-bottom: 12px; }
        .header h1 { margin: 0; font-size: 20px; color: #1E3A5F; }
        .header p { margin: 4px 0; font-size: 12px; color: #666; }
        .meta { font-size: 12px; margin-bottom: 12px; }
        .meta-row { display: flex; justify-content: space-between; margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { font-size: 12px; padding: 8px 4px; border-bottom: 1px dashed #ddd; }
        th { text-align: left; color: #555; }
        td:last-child, th:last-child { text-align: right; }
        .total { margin-top: 12px; border-top: 2px solid #eee; padding-top: 8px; }
        .total-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
        .grand-total { font-size: 16px; font-weight: 700; color: #F97316; }
        .footer { border-top: 2px dashed #ddd; margin-top: 14px; padding-top: 10px; text-align: center; font-size: 11px; color: #666; }
        @media print {
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>${receipt.hospitalName || "Medical Centre"}</h1>
          <p>MediCore HMS Platform</p>
          <p>Pharmacy POS Receipt</p>
        </div>

        <div class="meta">
          <div class="meta-row"><span>Receipt #</span><strong>${receipt.receiptNo}</strong></div>
          <div class="meta-row"><span>Date</span><span>${receipt.date || new Date().toLocaleString()}</span></div>
          <div class="meta-row"><span>Customer</span><span>${receipt.customerName || "Walk-in Customer"}</span></div>
          <div class="meta-row"><span>Cashier</span><span>${receipt.cashier || "Pharmacy"}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${receipt.medicineName}</td>
              <td>${receipt.quantity}</td>
              <td>${formatCurrency(receipt.unitPrice)}</td>
              <td>${formatCurrency(receipt.total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total">
          <div class="total-row"><span>Subtotal</span><span>${formatCurrency(receipt.total)}</span></div>
          <div class="total-row"><span>Tax</span><span>${formatCurrency(0)}</span></div>
          <div class="total-row grand-total"><span>Total Paid</span><span>${formatCurrency(receipt.total)}</span></div>
        </div>

        <div class="footer">
          <p>Thank you for your purchase.</p>
          <p>This is a computer-generated receipt.</p>
        </div>
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
