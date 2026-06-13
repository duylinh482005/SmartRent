import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { TrendingDown, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { expenseApi, type ExpenseRequest } from '../api/expenseApi';
import { propertyApi } from '../api/propertyApi';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import type { Expense, ExpenseCategory } from '../types';
import { formatVnd } from '../utils/format';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MAINTENANCE: 'Sửa chữa / bảo trì',
  UTILITY:     'Điện / nước chung',
  SERVICE:     'Dịch vụ (vệ sinh, bảo vệ)',
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

const schema = z.object({
  propertyId:     z.coerce.number().min(1, 'Vui lòng chọn khu trọ'),
  category:       z.enum(['MAINTENANCE','UTILITY','SERVICE','TAX','INSURANCE','RENOVATION','OTHER']),
  amount:         z.coerce.number().min(1000, 'Số tiền phải >= 1.000đ'),
  description:    z.string().min(1, 'Mô tả không được để trống').max(500),
  expenseDate:    z.string().min(1, 'Ngày phát sinh không được để trống'),
  receiptImageUrl: z.string().optional().nullable(),
});

type FormValues = z.input<typeof schema>;

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `Tháng ${Number(m)}/${y}`;
};

export default function ExpensePage() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [monthFilter, setMonthFilter]   = useState('');
  const [expensePage, setExpensePage]   = useState(1);
  const EXPENSE_PAGE_SIZE = 15;

  const currentMonthKey = toMonthKey(new Date());

  const fromDate = monthFilter ? `${monthFilter}-01` : undefined;
  const toDate   = monthFilter
    ? new Date(Number(monthFilter.split('-')[0]), Number(monthFilter.split('-')[1]), 0)
        .toISOString().slice(0, 10)
    : undefined;

  const { data: expensesRes, isLoading } = useQuery({
    queryKey: ['expenses', propertyFilter || null, fromDate, toDate],
    queryFn: () => expenseApi.getAll({
      propertyId: propertyFilter ? Number(propertyFilter) : undefined,
      from: fromDate,
      to: toDate,
    }),
  });
  const expenses = expensesRes?.data.data ?? [];

  // Query riêng không lọc tháng — dùng để build danh sách tháng trong dropdown
  const { data: allExpensesRes } = useQuery({
    queryKey: ['expenses-all', propertyFilter || null],
    queryFn: () => expenseApi.getAll({
      propertyId: propertyFilter ? Number(propertyFilter) : undefined,
    }),
  });
  const allExpenses = allExpensesRes?.data.data ?? [];

  const { data: propertiesRes } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyApi.getAll(),
  });
  const properties = propertiesRes?.data.data ?? [];

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { expenseDate: currentMonthKey + '-01', category: 'MAINTENANCE' },
  });

  const monthOptions = useMemo(() => {
    const keys = new Set(allExpenses.map(e => e.expenseDate.slice(0, 7)));
    if (!keys.has(currentMonthKey)) keys.add(currentMonthKey);
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [allExpenses, currentMonthKey]);

  // P&L summary for currently filtered view
  const totalExpense = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const expenseByCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    [expenses],
  );

  useEffect(() => setExpensePage(1), [expenses]);

  const totalExpensePages = Math.ceil(sortedExpenses.length / EXPENSE_PAGE_SIZE);
  const paginatedExpenses = sortedExpenses.slice(
    (expensePage - 1) * EXPENSE_PAGE_SIZE,
    expensePage * EXPENSE_PAGE_SIZE,
  );

  const openCreate = () => {
    setEditTarget(null);
    reset({ expenseDate: currentMonthKey + '-01', category: 'MAINTENANCE' });
    setModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditTarget(expense);
    setValue('propertyId', expense.propertyId);
    setValue('category', expense.category);
    setValue('amount', expense.amount);
    setValue('description', expense.description);
    setValue('expenseDate', expense.expenseDate);
    setValue('receiptImageUrl', expense.receiptImageUrl ?? '');
    setModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (form: FormValues) => {
      const payload: ExpenseRequest = {
        propertyId:      Number(form.propertyId),
        category:        form.category as ExpenseCategory,
        amount:          Number(form.amount),
        description:     form.description,
        expenseDate:     form.expenseDate,
        receiptImageUrl: form.receiptImageUrl || null,
      };
      return expenseApi.create(payload);
    },
    onSuccess: () => {
      toast.success('Đã thêm chi phí');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (form: FormValues) => {
      const payload: ExpenseRequest = {
        propertyId:      Number(form.propertyId),
        category:        form.category as ExpenseCategory,
        amount:          Number(form.amount),
        description:     form.description,
        expenseDate:     form.expenseDate,
        receiptImageUrl: form.receiptImageUrl || null,
      };
      return expenseApi.update(editTarget!.id, payload);
    },
    onSuccess: () => {
      toast.success('Đã cập nhật chi phí');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expenseApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa chi phí');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setDeleteTarget(null);
    },
  });

  const onSubmit = (form: FormValues) => {
    if (editTarget) updateMutation.mutate(form);
    else createMutation.mutate(form);
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <PageHeader
        icon={TrendingDown}
        title="Chi phí vận hành"
        subtitle={`${expenses.length} khoản chi`}
        action={(
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm text-white transition hover:bg-primary-900"
          >
            <Plus className="h-4 w-4" />
            Thêm chi phí
          </button>
        )}
      />

      {/* Bộ lọc */}
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Khu trọ</label>
            <select
              value={propertyFilter}
              onChange={e => setPropertyFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tất cả khu trọ</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Tháng</label>
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tất cả tháng</option>
              {monthOptions.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tổng quan */}
      {expenses.length > 0 && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <div className="text-xs font-medium text-red-600 mb-1">Tổng chi phí</div>
            <div className="text-xl font-bold text-red-700">{formatVnd(totalExpense)}</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-600 mb-2">Theo danh mục</div>
            <div className="space-y-1">
              {expenseByCategory.map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="font-medium text-gray-700">{formatVnd(amt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bảng danh sách */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-gray-400">Đang tải...</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium text-gray-600">Ngày</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Khu trọ</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Danh mục</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Mô tả</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Số tiền</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    Chưa có khoản chi nào
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map(expense => (
                    <tr key={expense.id} className="transition hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-600">{expense.expenseDate}</td>
                      <td className="px-5 py-3 text-gray-700">{expense.propertyName}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[expense.category]}`}>
                          {CATEGORY_LABELS[expense.category]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-700 max-w-xs truncate">{expense.description}</td>
                      <td className="px-5 py-3 text-right font-medium text-red-600">
                        {formatVnd(expense.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(expense)}
                            title="Sửa"
                            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-blue-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-400" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(expense)}
                            title="Xóa"
                            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
          {totalExpensePages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-white px-5 py-3">
              <span className="text-xs text-gray-500">
                {(expensePage - 1) * EXPENSE_PAGE_SIZE + 1}–{Math.min(expensePage * EXPENSE_PAGE_SIZE, sortedExpenses.length)} / {sortedExpenses.length} khoản chi
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpensePage(p => Math.max(1, p - 1))}
                  disabled={expensePage === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="px-2 text-xs text-gray-600">{expensePage} / {totalExpensePages}</span>
                <button
                  onClick={() => setExpensePage(p => Math.min(totalExpensePages, p + 1))}
                  disabled={expensePage === totalExpensePages}
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal thêm/sửa */}
      <Modal
        open={modalOpen}
        title={editTarget ? 'Sửa chi phí' : 'Thêm chi phí'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Khu trọ</label>
              <select
                {...register('propertyId')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Chọn khu trọ --</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.propertyId && <p className="mt-1 text-xs text-red-500">{errors.propertyId.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ngày phát sinh</label>
              <input
                type="date"
                {...register('expenseDate')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.expenseDate && <p className="mt-1 text-xs text-red-500">{errors.expenseDate.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Danh mục</label>
              <select
                {...register('category')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Số tiền (đ)</label>
              <input
                type="number"
                min={1000}
                step={1000}
                {...register('amount')}
                placeholder="Ví dụ: 500000"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
            <input
              type="text"
              {...register('description')}
              placeholder="Ví dụ: Thay bóng đèn hành lang tầng 2"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              URL ảnh hóa đơn / biên lai
              <span className="ml-1 text-xs font-normal text-gray-400">(tùy chọn)</span>
            </label>
            <input
              type="text"
              {...register('receiptImageUrl')}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm transition hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="flex items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm text-white transition hover:bg-primary-900 disabled:opacity-50"
            >
              {isMutating && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {editTarget ? 'Lưu thay đổi' : 'Thêm chi phí'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa chi phí"
        message={`Xóa khoản chi "${deleteTarget?.description}" — ${deleteTarget ? formatVnd(deleteTarget.amount) : ''}?`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
