import * as XLSX from "xlsx";

export function exportToExcel(data, filename = "export.xlsx") {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, filename);
}

export function exportBillsToExcel(data, filename = "bills.xlsx") {
  exportToExcel(data, filename);
}

export function exportPriceList(data, filename = "price_list.xlsx") {
  exportToExcel(data, filename);
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function downloadTemplate() {
  const template = [
    {
      name: "Paracetamol",
      category: "General",
      generic_name: "Acetaminophen",
      form: "tablet",
      strength: "500mg",
      quantity: 100,
      reorder_level: 20,
      cost_price: 0.05,
      selling_price: 0.1,
      batch_number: "BATCH-001",
      expiry_date: "2027-12-31",
      manufacturer: "MediPharm",
    },
  ];
  exportToExcel(template, "medicines_import_template.xlsx");
}

export function downloadPriceTemplate() {
  const template = [
    {
      "Service/Item": "Consultation",
      Category: "Consultation",
      "Price (SSP)": 500,
    },
  ];
  exportToExcel(template, "price_template.xlsx");
}
