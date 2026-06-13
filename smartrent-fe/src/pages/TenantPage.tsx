import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Users, Plus, Pencil, Trash2, Phone, Mail, CreditCard, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { contractApi } from '../api/contractApi';
import { tenantApi, type TenantRequest } from '../api/tenantApi';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import type { Contract, Tenant } from '../types';
import { formatVnd } from '../utils/format';

const schema = z.object({
  fullName:     z.string().min(1, 'Họ tên không được để trống'),
  phone:        z.string().regex(/^(0[3|5|7|8|9])+([0-9]{8})$/, 'Số điện thoại không hợp lệ'),
  email:        z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  idCardNumber: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Đã hết hạn',
  TERMINATED: 'Đã chấm dứt',
};

export default function TenantPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [modalOpen, setModalOpen]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [editing, setEditing]           = useState<Tenant | null>(null);
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 10;

  const tenantIdParam = searchParams.get('tenantId');
  const parsedTenantId = tenantIdParam ? Number(tenantIdParam) : null;
  const highlightedTenantId = parsedTenantId !== null && !Number.isNaN(parsedTenantId) ? parsedTenantId : null;

  const { data, isLoading } = useQuery({ // hook của React Query, gọi API lấy dữ liệu
    queryKey: ['tenants'],
    queryFn:  () => tenantApi.getAll(), // hàm thực sự gọi API, kết quả trả về lưu vào data
  });

  const { data: contractsRes } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractApi.getAll(),
  });

  const contracts = contractsRes?.data.data ?? [];

  const contractsByTenant = useMemo(() => (
    contracts.reduce<Record<number, Contract[]>>((acc, contract) => {
      if (!acc[contract.tenantId]) acc[contract.tenantId] = [];
      acc[contract.tenantId].push(contract);
      return acc;
    }, {})
  ), [contracts]);

  const tenants = (data?.data.data ?? []).filter(t =>
    t.fullName.toLowerCase().includes(search.toLowerCase()) ||
    t.phone.includes(search)
  );

  useEffect(() => setPage(1), [search]);

  const totalPages = Math.ceil(tenants.length / PAGE_SIZE);
  const paginatedTenants = tenants.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const openCreate = () => { setEditing(null); reset({}); setModalOpen(true); };
  const openEdit   = (t: Tenant) => {
    setEditing(t);
    reset({ fullName: t.fullName, phone: t.phone, email: t.email ?? '', idCardNumber: t.idCardNumber ?? '' });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload: TenantRequest = {
        fullName:     data.fullName,
        phone:        data.phone,
        email:        data.email || undefined,
        idCardNumber: data.idCardNumber || undefined,
      };
      return editing ? tenantApi.update(editing.id, payload) : tenantApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Thêm khách thuê thành công!');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tenantApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa khách thuê');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="p-6">
      <PageHeader
        icon={Users}
        title="Khách thuê"
        subtitle={`${tenants.length} khách thuê`}
        action={
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-primary-800 text-white px-4 py-2 rounded-xl text-sm hover:bg-primary-900 transition">
            <Plus className="w-4 h-4" /> Thêm khách thuê
          </button>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 mb-5 w-72">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên, SĐT..."
          className="text-sm outline-none bg-transparent flex-1 text-gray-700"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Đang tải...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Họ và tên</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Số điện thoại</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">CCCD</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Vi phạm</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Tiền cọc</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Hợp đồng</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Không có khách thuê nào</td></tr>
              ) : paginatedTenants.map(t => {
                const tenantContracts = contractsByTenant[t.id] ?? [];
                const activeContract = tenantContracts.find(c => c.status === 'ACTIVE');
                const isHighlighted = highlightedTenantId === t.id;

                return (
                  <tr
                    key={t.id}
                    className={`${isHighlighted ? 'bg-primary-50/70 hover:bg-primary-50' : 'hover:bg-gray-50'} transition`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm">
                          {t.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{t.fullName}</span>
                          {isHighlighted && (
                            <p className="text-xs text-primary-700">Mở từ trang hợp đồng</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Phone className="w-3.5 h-3.5" />
                        {t.phone}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {t.email ? (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Mail className="w-3.5 h-3.5" />
                          {t.email}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {t.idCardNumber ? (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <CreditCard className="w-3.5 h-3.5" />
                          {t.idCardNumber}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {t.latePaymentCount === 0 ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          {t.latePaymentCount} lần
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {activeContract == null ? (
                        <span className="text-gray-300">—</span>
                      ) : activeContract.depositBalance == null || activeContract.depositBalance === 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Đã hết</span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700">{formatVnd(activeContract.depositBalance)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {tenantContracts.length === 0 ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {tenantContracts.map(contract => (
                            <span
                              key={contract.id}
                              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                            >
                              HD #{contract.id} · P{contract.roomNumber} · {contract.propertyName} ({CONTRACT_STATUS_LABELS[contract.status] ?? contract.status})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(t)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button onClick={() => setDeleteTarget(t)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
              <span className="text-xs text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tenants.length)} / {tenants.length} khách thuê
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-xs text-gray-600 px-2">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} title={editing ? 'Cập nhật khách thuê' : 'Thêm khách thuê'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input {...register('fullName')} placeholder="VD: Nguyễn Văn An"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input {...register('phone')} placeholder="VD: 0912345678"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (tùy chọn)</label>
              <input {...register('email')} type="email" placeholder="VD: an@gmail.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CCCD (tùy chọn)</label>
              <input {...register('idCardNumber')} placeholder="VD: 001099012345"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition">Hủy</button>
            <button type="submit" disabled={saveMutation.isPending}
              className="px-4 py-2 text-sm rounded-xl bg-primary-800 text-white hover:bg-primary-900 disabled:opacity-50 transition flex items-center gap-2">
              {saveMutation.isPending && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editing ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa khách thuê"
        message={`Bạn có chắc muốn xóa khách thuê "${deleteTarget?.fullName}"?`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
