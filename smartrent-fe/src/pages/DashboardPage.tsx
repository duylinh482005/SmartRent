import { useQuery } from '@tanstack/react-query';
import {
  Building2, DoorOpen, Receipt, FileText,
  TrendingUp, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import { invoiceApi } from '../api/invoiceApi';
import { contractApi } from '../api/contractApi';
import { propertyApi } from '../api/propertyApi';
import { formatVnd, formatMonth, getInvoiceStatusColor } from '../utils/format';

export default function DashboardPage() {
  const { data: propertiesRes } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyApi.getAll(),
  });

  const { data: invoicesRes } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getAll(),
  });

  const { data: contractsRes } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractApi.getAll(),
  });

  const properties = propertiesRes?.data.data ?? [];
  const invoices   = invoicesRes?.data.data   ?? [];
  const contracts  = contractsRes?.data.data  ?? [];

  // Tính toán thống kê
  const totalRooms    = properties.reduce((sum, p) => sum + p.totalRooms, 0);
  const unpaidInvoices = invoices.filter(i => i.status === 'UNPAID' || i.status === 'OVERDUE');
  const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
  const paidThisMonth = invoices
    .filter(i => i.status === 'PAID')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  // Hợp đồng sắp hết hạn (30 ngày)
  const today = new Date();
  const expiringSoon = contracts.filter(c => {
    if (c.status !== 'ACTIVE') return false;
    const endDate = new Date(c.endDate);
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  const statCards = [
    {
      label: 'Tổng khu trọ',
      value: properties.length,
      icon: Building2,
      color: 'bg-blue-50 text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      label: 'Tổng phòng',
      value: totalRooms,
      icon: DoorOpen,
      color: 'bg-purple-50 text-purple-600',
      iconBg: 'bg-purple-100',
    },
    {
      label: 'Hợp đồng đang hiệu lực',
      value: activeContracts.length,
      icon: FileText,
      color: 'bg-green-50 text-green-600',
      iconBg: 'bg-green-100',
    },
    {
      label: 'Hóa đơn chưa thu',
      value: unpaidInvoices.length,
      icon: Receipt,
      color: 'bg-red-50 text-red-600',
      iconBg: 'bg-red-100',
    },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm">
          <TrendingUp className="w-4 h-4" />
          <span>Đã thu: {formatVnd(paidThisMonth)}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, iconBg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className={`w-5 h-5 ${color.split(' ')[1]}`} />
              </div>
            </div>
            <div className="text-2xl font-medium text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-2 gap-4">

        {/* Hóa đơn chưa thanh toán */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-sm text-gray-900">Hóa đơn chưa thanh toán</span>
            </div>
            <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
              {unpaidInvoices.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {unpaidInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
                <span className="text-sm">Tất cả đã thanh toán!</span>
              </div>
            ) : (
              unpaidInvoices.slice(0, 5).map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Phòng {invoice.roomNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      {invoice.tenantName} · Tháng {formatMonth(invoice.billingMonth)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-red-600">
                      {formatVnd(invoice.totalAmount)}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getInvoiceStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hợp đồng sắp hết hạn */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="font-medium text-sm text-gray-900">Hợp đồng sắp hết hạn</span>
            </div>
            <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
              {expiringSoon.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {expiringSoon.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
                <span className="text-sm">Không có hợp đồng sắp hết hạn</span>
              </div>
            ) : (
              expiringSoon.slice(0, 5).map(contract => {
                const diffDays = Math.ceil(
                  (new Date(contract.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={contract.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Phòng {contract.roomNumber}
                      </div>
                      <div className="text-xs text-gray-500">
                        {contract.tenantName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {new Date(contract.endDate).toLocaleDateString('vi-VN')}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        diffDays <= 7
                          ? 'bg-red-100 text-red-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}>
                        Còn {diffDays} ngày
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
