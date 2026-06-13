import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Building2, DoorOpen, Receipt, FileText,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  ArrowRight, CalendarDays, Wallet, Banknote, CreditCard,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { invoiceApi } from '../api/invoiceApi';
import { contractApi } from '../api/contractApi';
import { propertyApi } from '../api/propertyApi';
import { roomApi } from '../api/roomApi';
import { expenseApi } from '../api/expenseApi';
import { formatVnd } from '../utils/format';

export default function DashboardPage() {
  const navigate = useNavigate();
  const username = useAuthStore(s => s.username);

  const { data: propertiesRes } = useQuery({ queryKey: ['properties'],      queryFn: () => propertyApi.getAll() });
  const { data: invoicesRes }   = useQuery({ queryKey: ['invoices'],        queryFn: () => invoiceApi.getAll() });
  const { data: contractsRes }  = useQuery({ queryKey: ['contracts'],       queryFn: () => contractApi.getAll() });
  const { data: roomsRes }      = useQuery({ queryKey: ['rooms'],           queryFn: () => roomApi.getAll() });
  const { data: expensesRes }   = useQuery({ queryKey: ['expenses-all', null], queryFn: () => expenseApi.getAll() });

  const properties = propertiesRes?.data.data ?? [];
  const invoices   = invoicesRes?.data.data   ?? [];
  const contracts  = contractsRes?.data.data  ?? [];
  const rooms      = roomsRes?.data.data       ?? [];
  const expenses   = expensesRes?.data.data    ?? [];

  // ── Helpers ──────────────────────────────────────────────────────────────
  const now        = new Date();
  const toKey      = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const currentKey = toKey(now);
  const lastKey    = toKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const diffDays   = (to: Date) => Math.ceil((to.getTime() - now.getTime()) / 86_400_000);
  const pctChange  = (curr: number, prev: number): number | null =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

  // ── Phòng ────────────────────────────────────────────────────────────────
  const totalRooms       = rooms.length;
  const occupiedRooms    = rooms.filter(r => r.status === 'OCCUPIED').length;
  const availableRooms   = rooms.filter(r => r.status === 'AVAILABLE').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'MAINTENANCE').length;
  const occupancyRate    = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // ── Hợp đồng ─────────────────────────────────────────────────────────────
  const activeContracts = contracts.filter(c => c.status === 'ACTIVE');
  const expiringSoon    = activeContracts.filter(c => { const d = diffDays(new Date(c.endDate)); return d >= 0 && d <= 30; });

  // ── Hóa đơn ──────────────────────────────────────────────────────────────
  const overdueInvoices  = invoices.filter(i => i.status === 'OVERDUE');
  const unpaidInvoices   = invoices.filter(i => i.status === 'UNPAID');
  const allPending       = [...overdueInvoices, ...unpaidInvoices];
  const invoicedIds      = new Set(invoices.filter(i => i.billingMonth.startsWith(currentKey)).map(i => i.contractId));
  const missingInvoices  = activeContracts.filter(c => !invoicedIds.has(c.id));

  // ── Doanh thu ────────────────────────────────────────────────────────────
  const paidThisMonth = invoices
    .filter(i => i.status === 'PAID' && i.billingMonth.startsWith(currentKey))
    .reduce((s, i) => s + i.totalAmount, 0);
  const paidLastMonth = invoices
    .filter(i => i.status === 'PAID' && i.billingMonth.startsWith(lastKey))
    .reduce((s, i) => s + i.totalAmount, 0);

  // ── Chi phí ──────────────────────────────────────────────────────────────
  const expThisMonth = expenses
    .filter(e => e.expenseDate.startsWith(currentKey))
    .reduce((s, e) => s + e.amount, 0);
  const expLastMonth = expenses
    .filter(e => e.expenseDate.startsWith(lastKey))
    .reduce((s, e) => s + e.amount, 0);

  // ── Lợi nhuận ────────────────────────────────────────────────────────────
  const profitThisMonth = paidThisMonth - expThisMonth;
  const profitLastMonth = paidLastMonth - expLastMonth;
  const revChange    = pctChange(paidThisMonth, paidLastMonth);
  const expChange    = pctChange(expThisMonth, expLastMonth);
  const profitChange = pctChange(profitThisMonth, profitLastMonth);

  // ── Biểu đồ 6 tháng ──────────────────────────────────────────────────────
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = toKey(d);
    const revenue = invoices
      .filter(inv => inv.status === 'PAID' && inv.billingMonth.startsWith(key))
      .reduce((s, inv) => s + inv.totalAmount, 0);
    const expense = expenses
      .filter(exp => exp.expenseDate.startsWith(key))
      .reduce((s, exp) => s + exp.amount, 0);
    return { month: `T${d.getMonth() + 1}`, revenue, expense };
  });


  return (
    <div className="p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Xin chào, <span className="text-primary-700">{username}</span>!
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-xl">
          <CalendarDays className="w-4 h-4" />
          Tháng {now.getMonth() + 1}/{now.getFullYear()}
        </div>
      </div>


      {/* ── 4 Operational KPI cards ────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{properties.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Khu trọ</div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <DoorOpen className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs text-gray-400">{totalRooms} phòng</span>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{occupancyRate}%</div>
          <div className="text-xs text-gray-500 mt-0.5 mb-3">Tỷ lệ lấp đầy</div>
          <div className="space-y-2">
            {([
              { label: 'Đang thuê', count: occupiedRooms,    color: 'bg-purple-500', tc: 'text-purple-600' },
              { label: 'Còn trống', count: availableRooms,   color: 'bg-green-500',  tc: 'text-green-600'  },
              { label: 'Bảo trì',   count: maintenanceRooms, color: 'bg-yellow-400', tc: 'text-yellow-600' },
            ] as const).map(({ label, count, color, tc }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-xs font-medium ${tc}`}>{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`${color} h-1.5 rounded-full`}
                    style={{ width: totalRooms > 0 ? `${(count / totalRooms) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <button onClick={() => navigate('/contracts')} className="text-xs text-primary-700 hover:underline flex items-center gap-0.5">
              Xem <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{activeContracts.length}</div>
          <div className="text-xs text-gray-500 mt-0.5 mb-3">Hợp đồng hiệu lực</div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Còn hiệu lực</span>
              <span className="text-xs font-medium text-green-600">{activeContracts.length - expiringSoon.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Sắp hết hạn</span>
              <span className="text-xs font-medium text-orange-500">{expiringSoon.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-red-500" />
            </div>
            <button onClick={() => navigate('/invoices')} className="text-xs text-primary-700 hover:underline flex items-center gap-0.5">
              Xem <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="text-2xl font-semibold text-gray-900">{allPending.length}</div>
          <div className="text-xs text-gray-500 mt-0.5 mb-3">Hóa đơn chưa thu</div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Quá hạn</span>
              <span className="text-xs font-medium text-red-600">{overdueInvoices.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Sắp quá hạn</span>
              <span className="text-xs font-medium text-amber-600">{unpaidInvoices.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3 Financial KPI cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Doanh thu */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-400">T{now.getMonth() + 1}/{now.getFullYear()}</span>
          </div>
          <div className="text-lg font-semibold text-emerald-700">{formatVnd(paidThisMonth)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Doanh thu đã thu</div>
          {revChange !== null && (
            <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${revChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {revChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {revChange >= 0 ? '+' : ''}{revChange}% so T{now.getMonth()}
            </div>
          )}
        </div>

        {/* Chi phí */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-rose-500" />
            </div>
            <span className="text-xs text-gray-400">T{now.getMonth() + 1}/{now.getFullYear()}</span>
          </div>
          <div className="text-lg font-semibold text-rose-600">{formatVnd(expThisMonth)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Chi phí vận hành</div>
          {expChange !== null && (
            <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${expChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {expChange <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {expChange >= 0 ? '+' : ''}{expChange}% so T{now.getMonth()}
            </div>
          )}
        </div>

        {/* Lợi nhuận ròng */}
        <div className={`rounded-2xl p-4 shadow-sm border ${profitThisMonth >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${profitThisMonth >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <Wallet className={`w-5 h-5 ${profitThisMonth >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
            </div>
            <span className="text-xs text-gray-400">T{now.getMonth() + 1}/{now.getFullYear()}</span>
          </div>
          <div className={`text-lg font-semibold ${profitThisMonth >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {profitThisMonth < 0 && '-'}{formatVnd(Math.abs(profitThisMonth))}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Lợi nhuận ròng</div>
          {profitChange !== null && (
            <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${profitChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {profitChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {profitChange >= 0 ? '+' : ''}{profitChange}% so T{now.getMonth()}
            </div>
          )}
        </div>
      </div>

      {/* ── Biểu đồ + Hóa đơn chưa thu ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Biểu đồ doanh thu vs chi phí */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-sm text-gray-900">Doanh thu & Chi phí 6 tháng</span>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400" />Doanh thu
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-400" />Chi phí
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barGap={4} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                formatter={(v, name) => [
                  formatVnd(Number(v ?? 0)),
                  name === 'revenue' ? 'Doanh thu' : 'Chi phí',
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Bar dataKey="revenue" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expense" fill="#fb7185" radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Phòng chưa có hóa đơn tháng này */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-sm text-gray-900">Chưa có hóa đơn T{now.getMonth() + 1}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {missingInvoices.length} phòng
              </span>
              <button onClick={() => navigate('/invoices')}
                className="text-xs text-primary-700 hover:underline flex items-center gap-0.5">
                Tạo hóa đơn <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {missingInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <CheckCircle className="w-7 h-7 mb-2 text-green-400" />
                <span className="text-sm">Tất cả phòng đã có hóa đơn!</span>
              </div>
            ) : (
              missingInvoices.slice(0, 6).map(contract => (
                <div key={contract.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Phòng {contract.roomNumber}</div>
                    <div className="text-xs text-gray-400">{contract.tenantName}</div>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-600">
                    Chưa có HĐ
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
