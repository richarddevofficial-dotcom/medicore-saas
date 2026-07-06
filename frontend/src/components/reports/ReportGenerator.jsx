'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useHospitalSettings } from '@/hooks/useSettings';
import { FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api-client';

export default function ReportGenerator({ endpoint, title }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { data: hospital } = useHospitalSettings();
  const hospitalName = hospital?.name || 'Alliance Medical Centre';

  const generateReport = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(endpoint);
      setData(data);
      toast.success('Report generated!');
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank', 'width=500,height=700');
    printWindow.document.write(`
      <html><head><title>${title} - ${hospitalName}</title>
      <style>
        body{font-family:Arial;padding:30px;color:#333}
        .header{text-align:center;border-bottom:3px solid #1E3A5F;padding-bottom:15px;margin-bottom:20px}
        .header h1{color:#1E3A5F;margin:0}.header p{color:#666}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th{background:#1E3A5F;color:#fff;padding:10px;text-align:left}
        td{padding:10px;border-bottom:1px solid #ddd}
        .footer{text-align:center;margin-top:30px;color:#888;font-size:0.8em}
      </style></head><body>
      <div class="header"><h1>${hospitalName}</h1><h2>${title}</h2><p>Generated: ${new Date().toLocaleString()}</p></div>
      <table>${Object.entries(data || {}).filter(([k]) => !['generated_at','role'].includes(k)).map(([key, value]) => `
        <tr><td><strong>${key.replace(/_/g, ' ').toUpperCase()}</strong></td><td>${typeof value === 'number' ? value.toLocaleString() : value}</td></tr>
      `).join('')}</table>
      <div class="footer"><p>${hospitalName} - MediCore HMS</p></div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div>
      <Button onClick={generateReport} isLoading={loading} icon={FileText}>
        {loading ? 'Generating...' : 'Generate Report'}
      </Button>

      {data && (
        <Card className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{title} - {hospitalName}</h3>
            <Button variant="outline" size="sm" icon={Printer} onClick={printReport}>Print</Button>
          </div>
          <p className="text-xs text-gray-400 mb-4">Generated: {new Date(data.generated_at).toLocaleString()}</p>
          <div className="space-y-2">
            {Object.entries(data).filter(([key]) => !['generated_at', 'role'].includes(key)).map(([key, value]) => (
              <div key={key} className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
