import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Plus, Trash2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { contractApi, type ContractRequest } from '../api/contractApi';
import { propertyApi } from '../api/propertyApi';
import { roomApi } from '../api/roomApi';
import { tenantApi } from '../api/tenantApi';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import type { Contract } from '../types';
import { formatVnd, formatDate, getContractStatusColor } from '../utils/format';

const today = new Date();
today.setHours(0, 0, 0, 0);

const toDateOnlyValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (dateString: string) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const addMonths = (dateString: string, months: number) => {
  const date = parseDateInput(dateString);
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
};

const TODAY_DATE = toDateOnlyValue(today);

const schema = z
  .object({
    roomId: z.coerce.number().min(1, 'Vui lòng chọn phòng'),
    tenantId: z.coerce.number().min(1, 'Vui lòng chọn khách thuê'),
    startDate: z.string().min(1, 'Ngày bắt đầu không được để trống'),
    endDate: z.string().min(1, 'Ngày kết thúc không được để trống'),
    monthlyRent: z.coerce.number().min(1, 'Tiền thuê phải lớn hơn 0'),
  })
  .refine(data => {
    const startDate = parseDateInput(data.startDate);
    return !!startDate && startDate >= today;
  }, {
    message: 'Ngày bắt đầu không được ở trong quá khứ',
    path: ['startDate'],
  })
  .refine(data => {
    const startDate = parseDateInput(data.startDate);
    const endDate = parseDateInput(data.endDate);
    return !!startDate && !!endDate && endDate > startDate;
  }, {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  })
  .refine(data => {
    const minEndDate = addMonths(data.startDate, 6);
    if (!minEndDate) return false;
    const endDate = parseDateInput(data.endDate);
    return !!endDate && endDate >= minEndDate;
  }, {
    message: 'Thời hạn hợp đồng tối thiểu là 6 tháng',
    path: ['endDate'],
  });

type FormValues = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const quickTenantSchema = z.object({
  fullName: z.string().min(1, 'Họ tên không được để trống'),
  phone: z.string().regex(/^(0[3|5|7|8|9])+([0-9]{8})$/, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  idCardNumber: z.string().optional(),
});

type QuickTenantFormData = z.infer<typeof quickTenantSchema>;

const STATUS_LABELS: Record<Contract['status'], string> = {
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Đã hết hạn',
  TERMINATED: 'Đã chấm dứt',
};

const STATUS_OPTIONS: Contract['status'][] = ['ACTIVE', 'EXPIRED', 'TERMINATED'];
const NO_MATCH_MESSAGE = 'Không tìm thấy hợp đồng phù hợp';

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const getLevenshteinDistance = (a: string, b: string) => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => {
      if (i === 0) return j;
      if (j === 0) return i;
      return 0;
    })
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
};

const isFuzzyTenantMatch = (query: string, tenantName: string) => {
  const normalizedQuery = normalizeText(query);
  const normalizedTenantName = normalizeText(tenantName);

  if (!normalizedQuery) return true;
  if (!normalizedTenantName) return false;
  if (normalizedTenantName.includes(normalizedQuery)) return true;

  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  const tenantWords = normalizedTenantName.split(/\s+/).filter(Boolean);

  return queryWords.every(queryWord =>
    tenantWords.some(tenantWord => {
      if (tenantWord.includes(queryWord) || queryWord.includes(tenantWord)) {
        return true;
      }

      const maxDistance = queryWord.length <= 4 ? 1 : 2;
      return getLevenshteinDistance(queryWord, tenantWord) <= maxDistance;
    })
  );
};

const normalizeDate = (value: string) => {
  const date = parseDateInput(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export default function ContractPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<Contract | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<number | ''>('');
  const [quickTenantModalOpen, setQuickTenantModalOpen] = useState(false);

  const [tenantSearch, setTenantSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<Contract['status'][]>([]);
  const [endDateFrom, setEndDateFrom] = useState('');
  const [endDateTo, setEndDateTo] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractApi.getAll(),
  });
  const contracts = data?.data.data ?? [];

  const roomIdsKey = contracts
    .map(c => c.roomId)
    .sort((a, b) => a - b)
    .join(',');

  const { data: roomPropertyMap = {} } = useQuery({
    queryKey: ['contract-room-property-map', roomIdsKey],
    queryFn: async (): Promise<Record<number, string>> => {
      const uniqueRoomIds = Array.from(new Set(contracts.map(c => c.roomId)));
      const responses = await Promise.allSettled(
        uniqueRoomIds.map(async roomId => {
          const res = await roomApi.getById(roomId);
          return { roomId, propertyName: res.data.data.propertyName };
        })
      );

      return responses.reduce<Record<number, string>>((acc, item) => {
        if (item.status === 'fulfilled') {
          acc[item.value.roomId] = item.value.propertyName;
        }
        return acc;
      }, {});
    },
    enabled: contracts.length > 0,
  });

  const filteredContracts = useMemo(() => {
    const from = normalizeDate(endDateFrom);
    const to = normalizeDate(endDateTo);
    const normalizedRoomSearch = normalizeText(roomSearch);

    return [...contracts]
      .filter(contract => {
        if (!isFuzzyTenantMatch(tenantSearch, contract.tenantName)) {
          return false;
        }

        const propertyName = roomPropertyMap[contract.roomId] ?? '';
        if (propertyFilter && propertyName !== propertyFilter) {
          return false;
        }

        if (statusFilters.length > 0 && !statusFilters.includes(contract.status)) {
          return false;
        }

        const contractEndDate = normalizeDate(contract.endDate);
        if (from && (!contractEndDate || contractEndDate < from)) {
          return false;
        }
        if (to && (!contractEndDate || contractEndDate > to)) {
          return false;
        }

        if (normalizedRoomSearch && !normalizeText(contract.roomNumber).includes(normalizedRoomSearch)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.endDate).getTime();
        const bTime = new Date(b.endDate).getTime();

        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return aTime - bTime;
      });
  }, [contracts, endDateFrom, endDateTo, propertyFilter, roomPropertyMap, roomSearch, statusFilters, tenantSearch]);

  const filteredPropertyOptions = useMemo(
    () =>
      Array.from(new Set(contracts.map(c => roomPropertyMap[c.roomId]).filter((value): value is string => Boolean(value)))),
    [contracts, roomPropertyMap]
  );

  const { data: propertiesRes } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyApi.getAll(),
  });
  const properties = propertiesRes?.data.data ?? [];

  const { data: roomsRes } = useQuery({
    queryKey: ['rooms-available', selectedProperty],
    queryFn: () => roomApi.getByProperty(selectedProperty as number, 'AVAILABLE'),
    enabled: !!selectedProperty,
  });
  const availableRooms = roomsRes?.data.data ?? [];

  const { data: tenantsRes } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantApi.getAll(),
  });
  const tenants = tenantsRes?.data.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues, unknown, FormData>({
    resolver: zodResolver(schema),
  });

  const watchedStartDate = watch('startDate');
  const minEndDate = watchedStartDate
    ? toDateOnlyValue(addMonths(watchedStartDate, 6) ?? today)
    : '';

  const {
    register: registerQuickTenant,
    handleSubmit: handleSubmitQuickTenant,
    reset: resetQuickTenant,
    formState: { errors: quickTenantErrors },
  } = useForm<QuickTenantFormData>({
    resolver: zodResolver(quickTenantSchema),
  });

  const openCreate = () => {
    reset({});
    resetQuickTenant({});
    setSelectedProperty('');
    setQuickTenantModalOpen(false);
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (formData: FormData) => contractApi.create(formData as ContractRequest),
    onSuccess: () => {
      toast.success('Tạo hợp đồng thành công!');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setModalOpen(false);
    },
  });

  const terminateMutation = useMutation({
    mutationFn: (id: number) => contractApi.terminate(id),
    onSuccess: () => {
      toast.success('Đã chấm dứt hợp đồng');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setTerminateTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contractApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa hợp đồng');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setDeleteTarget(null);
    },
  });

  const quickCreateTenantMutation = useMutation({
    mutationFn: (tenantData: QuickTenantFormData) =>
      tenantApi.create({
        fullName: tenantData.fullName,
        phone: tenantData.phone,
        email: tenantData.email || undefined,
        idCardNumber: tenantData.idCardNumber || undefined,
      }),
    onSuccess: res => {
      const createdTenant = res.data.data;
      toast.success('Thêm khách thuê thành công!');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setValue('tenantId', createdTenant.id, { shouldValidate: true });
      setQuickTenantModalOpen(false);
      resetQuickTenant({});
    },
  });

  const toggleStatusFilter = (status: Contract['status']) => {
    setStatusFilters(prev =>
      prev.includes(status) ? prev.filter(item => item !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setTenantSearch('');
    setPropertyFilter('');
    setStatusFilters([]);
    setEndDateFrom('');
    setEndDateTo('');
    setRoomSearch('');
  };

  return (
    <div className="p-6">
      <PageHeader
        icon={FileText}
        title="Hợp đồng"
        subtitle={`${filteredContracts.length}/${contracts.length} hợp đồng`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm text-white transition hover:bg-primary-900"
          >
            <Plus className="h-4 w-4" /> Tạo hợp đồng
          </button>
        }
      />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-gray-400">Đang tải...</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tìm khách thuê</label>
                <input
                  type="text"
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  placeholder="Nhập tên khách thuê..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Khu trọ</label>
                <select
                  value={propertyFilter}
                  onChange={e => setPropertyFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Tất cả khu trọ</option>
                  {filteredPropertyOptions.map(propertyName => (
                    <option key={propertyName} value={propertyName}>
                      {propertyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Phòng</label>
                <input
                  type="text"
                  value={roomSearch}
                  onChange={e => setRoomSearch(e.target.value)}
                  placeholder="Nhập số phòng..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Ngày kết thúc từ</label>
                <input
                  type="date"
                  value={endDateFrom}
                  onChange={e => setEndDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Ngày kết thúc đến</label>
                <input
                  type="date"
                  value={endDateTo}
                  onChange={e => setEndDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  Xóa bộ lọc
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium text-gray-600">Trạng thái</span>
              <div className="flex flex-wrap gap-3">
                {STATUS_OPTIONS.map(status => (
                  <label key={status} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={statusFilters.includes(status)}
                      onChange={() => toggleStatusFilter(status)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-500"
                    />
                    {STATUS_LABELS[status]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Phòng</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Khu trọ</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Khách thuê</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Tiền thuê</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Ngày bắt đầu</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Ngày kết thúc</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600">Trạng thái</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400">
                      Chưa có hợp đồng nào
                    </td>
                  </tr>
                ) : filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400">
                      {NO_MATCH_MESSAGE}
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map(contract => (
                    <tr key={contract.id} className="transition hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{contract.roomNumber}</td>
                      <td className="px-5 py-3 text-gray-600">{roomPropertyMap[contract.roomId] ?? '-'}</td>
                      <td className="px-5 py-3 text-gray-700">
                        <button
                          type="button"
                          onClick={() => navigate(`/tenants?tenantId=${contract.tenantId}`)}
                          className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
                        >
                          {contract.tenantName}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-gray-900">{formatVnd(contract.monthlyRent)}</td>
                      <td className="px-5 py-3 text-gray-600">{formatDate(contract.startDate)}</td>
                      <td className="px-5 py-3 text-gray-600">{formatDate(contract.endDate)}</td>
                      <td className="px-5 py-3">
                        <Badge label={STATUS_LABELS[contract.status]} className={getContractStatusColor(contract.status)} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {contract.status === 'ACTIVE' && (
                            <button
                              onClick={() => setTerminateTarget(contract)}
                              title="Chấm dứt hợp đồng"
                              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-orange-50"
                            >
                              <XCircle className="h-3.5 w-3.5 text-orange-400" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(contract)}
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
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Tạo hợp đồng mới"
        onClose={() => {
          setModalOpen(false);
          setQuickTenantModalOpen(false);
        }}
        size="lg"
      >
        <form onSubmit={handleSubmit(formData => saveMutation.mutate(formData))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Khu trọ</label>
            <select
              value={selectedProperty}
              onChange={e => setSelectedProperty(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">-- Chọn khu trọ --</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phòng (còn trống)</label>
              <select
                {...register('roomId')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Chọn phòng --</option>
                {availableRooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} - {formatVnd(room.price)}/tháng
                  </option>
                ))}
              </select>
              {errors.roomId && <p className="mt-1 text-xs text-red-500">{errors.roomId.message}</p>}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-gray-700">Khách thuê</label>
                <button
                  type="button"
                  onClick={() => setQuickTenantModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-2.5 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm mới
                </button>
              </div>
              <select
                {...register('tenantId')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Chọn khách thuê --</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.fullName} - {tenant.phone}
                  </option>
                ))}
              </select>
              {errors.tenantId && <p className="mt-1 text-xs text-red-500">{errors.tenantId.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ngày bắt đầu</label>
              <input
                {...register('startDate')}
                type="date"
                min={TODAY_DATE}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ngày kết thúc</label>
              <input
                {...register('endDate')}
                type="date"
                min={minEndDate || TODAY_DATE}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate.message}</p>}
              <p className="mt-1 text-xs text-gray-500">Hợp đồng phải có thời hạn tối thiểu 6 tháng.</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tiền thuê hàng tháng (đ)</label>
            <input
              {...register('monthlyRent')}
              type="number"
              placeholder="VD: 3000000"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.monthlyRent && <p className="mt-1 text-xs text-red-500">{errors.monthlyRent.message}</p>}
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
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm text-white transition hover:bg-primary-900 disabled:opacity-50"
            >
              {saveMutation.isPending && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Tạo hợp đồng
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={quickTenantModalOpen}
        title="Thêm nhanh khách thuê"
        onClose={() => {
          setQuickTenantModalOpen(false);
          resetQuickTenant({});
        }}
      >
        <form onSubmit={handleSubmitQuickTenant(tenantData => quickCreateTenantMutation.mutate(tenantData))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Họ và tên</label>
            <input
              {...registerQuickTenant('fullName')}
              placeholder="VD: Nguyễn Văn An"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {quickTenantErrors.fullName && <p className="mt-1 text-xs text-red-500">{quickTenantErrors.fullName.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Số điện thoại</label>
            <input
              {...registerQuickTenant('phone')}
              placeholder="VD: 0912345678"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {quickTenantErrors.phone && <p className="mt-1 text-xs text-red-500">{quickTenantErrors.phone.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email (tùy chọn)</label>
              <input
                {...registerQuickTenant('email')}
                type="email"
                placeholder="VD: an@gmail.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {quickTenantErrors.email && <p className="mt-1 text-xs text-red-500">{quickTenantErrors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">CCCD (tùy chọn)</label>
              <input
                {...registerQuickTenant('idCardNumber')}
                placeholder="VD: 001099012345"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setQuickTenantModalOpen(false);
                resetQuickTenant({});
              }}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm transition hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={quickCreateTenantMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm text-white transition hover:bg-primary-900 disabled:opacity-50"
            >
              {quickCreateTenantMutation.isPending && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Thêm mới
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!terminateTarget}
        title="Chấm dứt hợp đồng"
        message={`Chấm dứt hợp đồng phòng "${terminateTarget?.roomNumber}" của "${terminateTarget?.tenantName}"? Phòng sẽ chuyển về trạng thái trống.`}
        onConfirm={() => terminateTarget && terminateMutation.mutate(terminateTarget.id)}
        onClose={() => setTerminateTarget(null)}
        loading={terminateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa hợp đồng"
        message="Bạn có chắc muốn xóa hợp đồng này?"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
