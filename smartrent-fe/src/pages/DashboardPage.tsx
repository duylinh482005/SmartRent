import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Building2, DoorOpen, Receipt, FileText,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Clock, ArrowRight, CalendarDays, Wallet,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { invoiceApi } from '../api/invoiceApi';
import { contractApi } from '../api/contractApi';
import { propertyApi } from '../api/propertyApi';
import { roomApi } from '../api/roomApi';
import { expenseApi } from '../api/expenseApi';
import { formatVnd, formatMonth } from '../utils/format';
import type { ExpenseCategory } from '../types';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MAINTENANCE: 'Sửa chữa',
  UTILITY:     'Điện / nước',
  SERVICE:     'Dịch vụ',
  TAX:         'Thuế',
  INSURANCE:   'Bảo hiểm',
  RENOVATION:  'Cải tạo',
  OTHER:       'Khác',
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  UTILITY:     'bg-blue-100 text-blue-700',
  SERVICE:     'bg-purple-100 text-purple-700',
  TAX:         'bg-red-100 text-red-700',
  INSURANCE:   'bg-teal-100 text-teal-700',
  RENOVATION:  'bg-yellow-100 text-yellow-700',
  OTHER:       'bg-gray-100 text-gray-700',
};

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
  const expiring7       = expiringSoon.filter(c => diffDays(new Date(c.endDate)) <= 7);

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

  // ── Chi phí tháng này theo danh mục ──────────────────────────────────────
  const expByCategoryThisMonth = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of expenses.filter(ex => ex.expenseDate.startsWith(currentKey))) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, currentKey]);

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

  // ── Alerts ───────────────────────────────────────────────────────────────
  type Alert = { key: string; color: string; text: string; to: string };
  const alerts: Alert[] = [
    ...(missingInvoices.length > 0 ? [{
      key: 'missing', to: '/invoices',
      color: 'bg-amber-50 border-amber-200 text-amber-700',
      text: `${missingInvoices.length} phòng chưa có hóa đơn tháng ${now.getMonth() + 1}`,
    }] : []),
    ...(expiring7.length > 0 ? [{
      key: 'exp7', to: '/contracts',
      color: 'bg-red-50 border-red-200 text-red-700',
      text: `${expiring7.length} hợp đồng hết hạn trong 7 ngày`,
    }] : []),
    ...(overdueInvoices.length > 0 ? [{
      key: 'overdue', to: '/invoices',
      color: 'bg-orange-50 border-orange-200 text-orange-700',
      text: `${overdueInvoices.length} hóa đơn đã quá hạn`,
    }] : []),
  ];

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

      {/* ── Alert banners ─────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map(a => (
            <button key={a.key} onClick={() => navigate(a.to)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium hover:opacity-80 transition ${a.color}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {a.text}
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          ))}
        </div>
      )}

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
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
            <DoorOpen className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-gray-900">{occupiedRooms}</span>
            <span className="text-sm text-gray-400">/ {totalRooms}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 mb-2">Phòng đang thuê</div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${occupancyRate}%` }} />
          </div>
          <div className="flex justify-between text-xs mt-1.5">
            <span className="text-purple-600 font-medium">{occupancyRate}% lấp đầy</span>
            {availableRooms > 0 && <span className="text-green-600">{availableRooms} trống</span>}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{activeContracts.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Hợp đồng hiệu lực</div>
          {expiringSoon.length > 0 && (
            <div className="text-xs text-orange-500 mt-2 font-medium">{expiringSoon.length} sắp hết hạn</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center mb-3">
            <Receipt className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{allPending.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Hóa đơn chưa thu</div>
          {overdueInvoices.length > 0 && (
            <div className="text-xs text-red-500 mt-2 font-medium">{overdueInvoices.length} quá hạn</div>
          )}
        </div>
      </div>

      {/* ── 3 Financial KPI cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Doanh thu */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
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
              <TrendingDown className="w-5 h-5 text-rose-500" />
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

        {/* Hóa đơn chưa thu */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-sm text-gray-900">Hóa đơn chưa thu</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
                {allPending.length}
              </span>
              <button onClick={() => navigate('/invoices')}
                className="text-xs text-primary-700 hover:underline flex items-center gap-0.5">
                Xem tất cả <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {allPending.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <CheckCircle className="w-7 h-7 mb-2 text-green-400" />
                <span className="text-sm">Tất cả đã thanh toán!</span>
              </div>
            ) : (
              allPending.slice(0, 5).map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Phòng {invoice.roomNumber}</div>
                    <div className="text-xs text-gray-400">
                      {invoice.tenantName} · T{formatMonth(invoice.billingMonth)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700">{formatVnd(invoice.totalAmount)}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      invoice.status === 'OVERDUE'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {invoice.status === 'OVERDUE' ? 'Quá hạn' : 'Chưa thu'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Hợp đồng + Trạng thái phòng + Chi phí danh mục ─────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Hợp đồng sắp hết hạn */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="font-medium text-sm text-gray-900">Hợp đồng sắp hết hạn</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
                {expiringSoon.length}
              </span>
              <button onClick={() => navigate('/contracts')}
                className="text-xs text-primary-700 hover:underline flex items-center gap-0.5">
                Xem <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {expiringSoon.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <CheckCircle className="w-7 h-7 mb-2 text-green-400" />
                <span className="text-sm">Không có sắp hết hạn</span>
              </div>
            ) : (
              expiringSoon.slice(0, 4).map(contract => {
                const d = diffDays(new Date(contract.endDate));
                return (
                  <div key={contract.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Phòng {contract.roomNumber}</div>
                      <div className="text-xs text-gray-400">{contract.tenantName}</div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      d <= 7 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      Còn {d} ngày
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Trạng thái phòng */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <DoorOpen className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-sm text-gray-900">Trạng thái phòng</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Đang thuê', count: occupiedRooms,    color: 'bg-blue-500' },
              { label: 'Còn trống', count: availableRooms,   color: 'bg-green-500' },
              { label: 'Bảo trì',   count: maintenanceRooms, color: 'bg-yellow-400' },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600">{label}</span>
                  <span className="text-xs font-medium text-gray-800">{count} / {totalRooms}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`${color} h-2 rounded-full`}
                    style={{ width: totalRooms > 0 ? `${(count / totalRooms) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-3 text-center">
            <div>
              <div className="text-xl font-semibold text-blue-600">{occupiedRooms}</div>
              <div className="text-xs text-gray-400 mt-0.5">Đang thuê</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-green-600">{availableRooms}</div>
              <div className="text-xs text-gray-400 mt-0.5">Còn trống</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-yellow-500">{maintenanceRooms}</div>
              <div className="text-xs text-gray-400 mt-0.5">Bảo trì</div>
            </div>
          </div>
        </div>

        {/* Chi phí tháng này theo danh mục */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span className="font-medium text-sm text-gray-900">Chi phí T{now.getMonth() + 1} theo loại</span>
            </div>
            <button onClick={() => navigate('/expenses')}
              className="text-xs text-primary-700 hover:underline flex items-center gap-0.5">
              Xem <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            {expByCategoryThisMonth.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-gray-400">
                <CheckCircle className="w-7 h-7 mb-2 text-gray-300" />
                <span className="text-sm">Chưa có chi phí tháng này</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {expByCategoryThisMonth.map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{formatVnd(amt)}</span>
                  </div>
                ))}
                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Tổng tháng này</span>
                  <span className="text-sm font-semibold text-rose-600">{formatVnd(expThisMonth)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
