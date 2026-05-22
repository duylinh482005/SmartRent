import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Receipt,
  Plus,
  Trash2,
  CheckCircle,
  Download,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { invoiceApi, type InvoiceRequest } from '../api/invoiceApi';
import { contractApi } from '../api/contractApi';
import { propertyApi } from '../api/propertyApi';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import type { Contract, Invoice } from '../types';
import { formatDate, formatMonth, formatVnd, getInvoiceStatusColor } from '../utils/format';

const schema = z.object({
  contractId:   z.coerce.number().min(1, 'Vui lòng chọn hợp đồng'),
  billingMonth: z.string().min(1, 'Vui lòng chọn tháng'),
  electricNew:  z.coerce.number().min(0, 'Chỉ số phải >= 0'),
  waterNew:     z.coerce.number().min(0, 'Chỉ số phải >= 0'),
  servicePeople: z.coerce.number().min(0, 'Số người phải >= 0'),
});

type FormValues = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const STATUS_LABELS: Record<Invoice['status'], string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
};

const STATUS_OPTIONS: Invoice['status'][] = ['OVERDUE', 'UNPAID', 'PAID'];

const STATUS_PRIORITY: Record<Invoice['status'], number> = {
  OVERDUE: 0,
  UNPAID: 1,
  PAID: 2,
};

const NO_MATCH_MESSAGE = 'Không tìm thấy hóa đơn phù hợp';

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
    }),
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
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
    }),
  );
};

const getMonthKey = (value: string) => {
  if (!value) return '';
  const [year, month] = value.split('-');
  if (!year || !month) return '';
  return `${year}-${month.padStart(2, '0')}`;
};

const parseMonthTimestamp = (value: string) => {
  const monthKey = getMonthKey(value);
  if (!monthKey) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(`${monthKey}-01T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

type InvoiceWithOptionalDueDate = Invoice & {
  dueDate?: string | null;
  paymentDueDate?: string | null;
  dueAt?: string | null;
};

const resolveDueDate = (invoice: Invoice): Date | null => {
  const extInvoice = invoice as InvoiceWithOptionalDueDate;
  const dueValue = extInvoice.dueDate ?? extInvoice.paymentDueDate ?? extInvoice.dueAt;

  if (dueValue) {
    const parsed = new Date(dueValue);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const monthKey = getMonthKey(invoice.billingMonth);
  if (!monthKey) return null;

  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return new Date(year, month, 0);
};

const canMarkAsPaid = (invoice: Invoice) => invoice.status === 'UNPAID' || invoice.status === 'OVERDUE';

const getPaidDateLabel = (invoice: Invoice) => {
  if (!invoice.paidAt) return 'không xác định';
  const formatted = formatDate(invoice.paidAt);
  return formatted || 'không xác định';
};

const getDeleteBlockedMessage = (invoice: Invoice): string | null => {
  if (invoice.status === 'PAID') {
    return `Không thể xóa: Hóa đơn đã được thanh toán ngày ${getPaidDateLabel(invoice)}`;
  }

  if (invoice.notificationSent) {
    return 'Không thể xóa: Đã gửi thông báo cho khách thuê';
  }

  if (invoice.status === 'OVERDUE') {
    return 'Không thể xóa: Hóa đơn đang ở trạng thái "Quá hạn"';
  }

  if (invoice.status !== 'UNPAID') {
    return 'Không thể xóa: Trạng thái hóa đơn không hợp lệ';
  }

  return null;
};

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const shiftMonthKey = (monthKey: string, offset: number) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) return '';

  const shifted = new Date(year, month - 1 + offset, 1);
  return toMonthKey(shifted);
};

const formatBillingMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return `Tháng ${Number(month)}/${year}`;
};

export default function InvoicePage() {
  const queryClient = useQueryClient();
  const billingMonthOptions = useMemo(() => {
    const currentMonthKey = toMonthKey(new Date());
    const previousMonthKey = shiftMonthKey(currentMonthKey, -1);
    return [currentMonthKey, previousMonthKey].map(value => ({
      value,
      label: formatBillingMonthLabel(value),
    }));
  }, []);
  const allowedBillingMonthKeys = useMemo(
    () => billingMonthOptions.map(option => option.value),
    [billingMonthOptions],
  );
  const defaultBillingMonth = billingMonthOptions[0]?.value ?? '';

  const [modalOpen, setModalOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [createPropertyId, setCreatePropertyId] = useState<number | ''>('');
  const [createRoomId, setCreateRoomId] = useState<number | ''>('');
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [pendingCreateForm, setPendingCreateForm] = useState<FormData | null>(null);
  const [pendingRoomsOpen, setPendingRoomsOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<Invoice['status'][]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getAll(),
  });
  const invoices = data?.data.data ?? [];

  const { data: propertiesRes } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyApi.getAll(),
  });
  const managedProperties = propertiesRes?.data.data ?? [];

  const { data: contractsRes } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractApi.getAll(),
  });
  const activeContracts = (contractsRes?.data.data ?? []).filter(c => c.status === 'ACTIVE') as Contract[];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      billingMonth: defaultBillingMonth,
      electricNew: 0,
      waterNew: 0,
      servicePeople: 0,
    },
  });

  const watchedContractId   = Number(watch('contractId') ?? 0);
  const watchedBillingMonth = watch('billingMonth');
  const watchedElectricNew  = Number(watch('electricNew') ?? 0);
  const watchedWaterNew     = Number(watch('waterNew') ?? 0);
  const watchedServicePeople = Number(watch('servicePeople') ?? 0);

  const monthOptions = useMemo(
    () =>
      Array.from(
        new Set(
          invoices
            .map(invoice => getMonthKey(invoice.billingMonth))
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [invoices],
  );

  const propertyOptions = useMemo(
    () =>
      Array.from(new Set(invoices.map(invoice => invoice.propertyName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
    [invoices],
  );

  const roomOptions = useMemo(
    () =>
      Array.from(new Set(invoices.map(invoice => invoice.roomNumber).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'vi', { numeric: true }),
      ),
    [invoices],
  );

  const createPropertyOptions = useMemo(
    () => [...managedProperties].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [managedProperties],
  );

  const createRoomOptions = useMemo(() => {
    if (!createPropertyId) return [];

    const roomMap = new Map<number, { id: number; roomNumber: string }>();
    activeContracts
      .filter(contract => contract.propertyId === Number(createPropertyId))
      .forEach(contract => {
        roomMap.set(contract.roomId, { id: contract.roomId, roomNumber: contract.roomNumber });
      });

    return [...roomMap.values()].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'vi', { numeric: true }));
  }, [activeContracts, createPropertyId]);

  const contractsForCreateRoom = useMemo(() => {
    if (!createRoomId) return [];
    return activeContracts.filter(contract => contract.roomId === Number(createRoomId));
  }, [activeContracts, createRoomId]);

  const selectedContract = useMemo(
    () => contractsForCreateRoom.find(contract => contract.id === watchedContractId) ?? null,
    [contractsForCreateRoom, watchedContractId],
  );

  const selectedProperty = useMemo(
    () => createPropertyOptions.find(property => property.id === Number(createPropertyId)) ?? null,
    [createPropertyId, createPropertyOptions],
  );

  const selectedRoomNumber = useMemo(
    () => createRoomOptions.find(room => room.id === Number(createRoomId))?.roomNumber ?? '',
    [createRoomId, createRoomOptions],
  );

  const selectedMonthKey = getMonthKey(watchedBillingMonth);
  const previousMonthKey = selectedMonthKey ? shiftMonthKey(selectedMonthKey, -1) : '';

  const roomInvoicesForCreate = useMemo(() => {
    if (!selectedProperty?.name || !selectedRoomNumber) return [];
    return invoices.filter(
      invoice =>
        invoice.propertyName === selectedProperty.name
        && invoice.roomNumber === selectedRoomNumber,
    );
  }, [invoices, selectedProperty?.name, selectedRoomNumber]);

  const previousMonthInvoice = useMemo(() => {
    if (!previousMonthKey) return null;

    return roomInvoicesForCreate
      .filter(invoice => getMonthKey(invoice.billingMonth) === previousMonthKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  }, [previousMonthKey, roomInvoicesForCreate]);

  const sameMonthInvoices = useMemo(() => {
    if (!selectedMonthKey) return [];
    return roomInvoicesForCreate
      .filter(invoice => getMonthKey(invoice.billingMonth) === selectedMonthKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [roomInvoicesForCreate, selectedMonthKey]);

  const duplicateInvoiceMessage = selectedMonthKey && selectedRoomNumber && sameMonthInvoices.length > 0
    ? `Phòng ${selectedRoomNumber} đã có hóa đơn tháng ${formatBillingMonthLabel(selectedMonthKey).replace('Tháng ', '')}. Bạn có chắc muốn tạo thêm không?`
    : null;

  const electricOldDisplay = previousMonthInvoice?.electricNew ?? 0;
  const waterOldDisplay    = previousMonthInvoice?.waterNew ?? 0;

  const missingPreviousDataWarning = Boolean(selectedContract && !previousMonthInvoice);

  const currentElectricUsed = Math.max(0, watchedElectricNew - electricOldDisplay);
  const currentWaterUsed    = Math.max(0, watchedWaterNew - waterOldDisplay);
  const electricUsageWarning = Boolean(
    previousMonthInvoice
    && previousMonthInvoice.electricUsed > 0
    && currentElectricUsed > previousMonthInvoice.electricUsed * 1.5,
  );
  const waterUsageWarning = Boolean(
    previousMonthInvoice
    && previousMonthInvoice.waterUsed > 0
    && currentWaterUsed > previousMonthInvoice.waterUsed * 1.5,
  );

  const electricFeePreview = currentElectricUsed * (selectedProperty?.electricUnitPrice ?? 0);
  const waterFeePreview    = currentWaterUsed    * (selectedProperty?.waterUnitPrice ?? 0);
  const serviceFeePreview  = watchedServicePeople * (selectedProperty?.serviceUnitPrice ?? 0);
  const networkFeePreview  = selectedProperty?.networkFee ?? 0;
  const totalPreview = (selectedContract?.monthlyRent ?? 0)
    + electricFeePreview + waterFeePreview + serviceFeePreview + networkFeePreview;

  const pendingContracts = useMemo(() => {
    const invoicedContractIds = new Set(
      invoices
        .filter(inv => getMonthKey(inv.billingMonth) === defaultBillingMonth)
        .map(inv => inv.contractId),
    );
    return [...activeContracts]
      .filter(c => !invoicedContractIds.has(c.id))
      .sort((a, b) => {
        const propCmp = a.propertyName.localeCompare(b.propertyName, 'vi');
        if (propCmp !== 0) return propCmp;
        return a.roomNumber.localeCompare(b.roomNumber, 'vi', { numeric: true });
      });
  }, [activeContracts, defaultBillingMonth, invoices]);

  const filteredInvoices = useMemo(() => {
    return [...invoices]
      .filter(invoice => {
        if (!isFuzzyTenantMatch(tenantSearch, invoice.tenantName)) {
          return false;
        }

        if (monthFilter && getMonthKey(invoice.billingMonth) !== monthFilter) {
          return false;
        }

        if (propertyFilter && invoice.propertyName !== propertyFilter) {
          return false;
        }

        if (roomFilter && invoice.roomNumber !== roomFilter) {
          return false;
        }

        if (statusFilters.length > 0 && !statusFilters.includes(invoice.status)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (statusDiff !== 0) return statusDiff;

        const monthDiff = parseMonthTimestamp(b.billingMonth) - parseMonthTimestamp(a.billingMonth);
        if (monthDiff !== 0) return monthDiff;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [invoices, monthFilter, propertyFilter, roomFilter, statusFilters, tenantSearch]);

  useEffect(() => {
    if (!createRoomId) {
      // Avoid redundant RHF updates that can trigger re-render loops.
      if (watchedContractId !== 0) {
        setValue('contractId', 0, { shouldValidate: true });
      }
      return;
    }

    if (contractsForCreateRoom.length === 1) {
      const onlyContractId = contractsForCreateRoom[0].id;
      if (watchedContractId !== onlyContractId) {
        setValue('contractId', onlyContractId, { shouldValidate: true });
      }
      return;
    }

    if (!contractsForCreateRoom.some(contract => contract.id === watchedContractId)) {
      if (watchedContractId !== 0) {
        setValue('contractId', 0, { shouldValidate: true });
      }
    }
  }, [contractsForCreateRoom, createRoomId, setValue, watchedContractId]);

  useEffect(() => {
    if (!selectedContract?.id) return;
    setValue('servicePeople', previousMonthInvoice?.servicePeople ?? 0, { shouldValidate: true });
  }, [
    previousMonthInvoice?.servicePeople,
    selectedContract?.id,
    selectedMonthKey,
    setValue,
  ]);

  const resetCreateInvoiceForm = () => {
    reset({
      contractId: 0,
      billingMonth: defaultBillingMonth,
      electricNew: 0,
      waterNew: 0,
      servicePeople: 0,
    });
    setCreatePropertyId('');
    setCreateRoomId('');
    setDuplicateConfirmOpen(false);
    setPendingCreateForm(null);
  };

  const createMutation = useMutation({
    mutationFn: (form: FormData) => {
      const payload: InvoiceRequest = {
        contractId:   form.contractId,
        billingMonth: `${form.billingMonth}-01`,
        electricNew:  form.electricNew,
        waterNew:     form.waterNew,
        servicePeople: form.servicePeople,
      };
      return invoiceApi.create(payload);
    },
    onSuccess: () => {
      toast.success('Tạo hóa đơn thành công!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setModalOpen(false);
      resetCreateInvoiceForm();
    },
  });

  const openCreateModal = () => {
    resetCreateInvoiceForm();
    setModalOpen(true);
  };

  const openCreateFromPending = (contract: Contract) => {
    reset({
      contractId: 0,
      billingMonth: defaultBillingMonth,
      electricNew: 0,
      waterNew: 0,
      servicePeople: 0,
    });
    setDuplicateConfirmOpen(false);
    setPendingCreateForm(null);
    setCreatePropertyId(contract.propertyId);
    setCreateRoomId(contract.roomId);
    setPendingRoomsOpen(false);
    setModalOpen(true);
  };

  const handleCreateSubmit = (form: FormData) => {
    if (!createPropertyId) {
      toast.error('Vui lòng chọn khu trọ trước');
      return;
    }

    if (createRoomOptions.length === 0) {
      toast.error('Không có phòng nào đang có hợp đồng hiệu lực tại khu này');
      return;
    }

    if (!createRoomId) {
      toast.error('Vui lòng chọn phòng trước');
      return;
    }

    if (!selectedContract) {
      toast.error('Vui lòng chọn hợp đồng trước');
      return;
    }

    const monthKey = getMonthKey(form.billingMonth);
    if (!allowedBillingMonthKeys.includes(monthKey)) {
      toast.error('Không thể tạo hóa đơn cho tháng tương lai');
      return;
    }

    if (form.electricNew < electricOldDisplay) {
      toast.error(`Chỉ số điện (${form.electricNew}) nhỏ hơn tháng trước (${electricOldDisplay})`);
      return;
    }

    if (form.waterNew < waterOldDisplay) {
      toast.error(`Chỉ số nước (${form.waterNew}) nhỏ hơn tháng trước (${waterOldDisplay})`);
      return;
    }

    if (duplicateInvoiceMessage) {
      setPendingCreateForm(form);
      setDuplicateConfirmOpen(true);
      return;
    }

    createMutation.mutate(form);
  };

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => invoiceApi.markAsPaid(id),
    onSuccess: () => {
      toast.success('Đã đánh dấu thanh toán!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoiceApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa hóa đơn');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteTarget(null);
    },
  });

  const handleDownloadPdf = async (invoice: Invoice) => {
    setPdfLoading(invoice.id);
    try {
      const res = await invoiceApi.downloadPdf(invoice.id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hoadon_${invoice.id}_thang${invoice.billingMonth}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải hóa đơn PDF');
    } catch {
      toast.error('Lỗi khi tải PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDeleteRequest = (invoice: Invoice) => {
    const blockedMessage = getDeleteBlockedMessage(invoice);
    if (blockedMessage) {
      toast.error(blockedMessage);
      return;
    }

    setDeleteTarget(invoice);
  };

  const handleCreatePropertyChange = (value: string) => {
    setCreatePropertyId(value ? Number(value) : '');
    setCreateRoomId('');
    setValue('contractId', 0, { shouldValidate: true });
  };

  const handleCreateRoomChange = (value: string) => {
    setCreateRoomId(value ? Number(value) : '');
    setValue('contractId', 0, { shouldValidate: true });
  };

  const handleCreateContractChange = (value: string) => {
    setValue('contractId', value ? Number(value) : 0, { shouldValidate: true });
  };

  const handleConfirmDuplicateCreate = () => {
    if (!pendingCreateForm) return;
    createMutation.mutate(pendingCreateForm);
    setPendingCreateForm(null);
    setDuplicateConfirmOpen(false);
  };

  const toggleStatusFilter = (status: Invoice['status']) => {
    setStatusFilters(prev =>
      prev.includes(status) ? prev.filter(item => item !== status) : [...prev, status],
    );
  };

  const clearFilters = () => {
    setTenantSearch('');
    setMonthFilter('');
    setPropertyFilter('');
    setRoomFilter('');
    setStatusFilters([]);
  };

  const totalUnpaid = filteredInvoices
    .filter(invoice => invoice.status !== 'PAID')
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0);

  return (
    <div className="p-6">
      <PageHeader
        icon={Receipt}
        title="Hóa đơn"
        subtitle={`${filteredInvoices.length}/${invoices.length} hóa đơn`}
        action={(
          <button
            onClick={() => setPendingRoomsOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm text-white transition hover:bg-primary-900"
          >
            <Plus className="h-4 w-4" />
            Tạo hóa đơn
          </button>
        )}
      />

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
            <label className="mb-1 block text-xs font-medium text-gray-600">Tháng/Năm</label>
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tất cả tháng</option>
              {monthOptions.map(month => (
                <option key={month} value={month}>
                  {formatMonth(`${month}-01`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Khu trọ</label>
            <select
              value={propertyFilter}
              onChange={e => setPropertyFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tất cả khu trọ</option>
              {propertyOptions.map(property => (
                <option key={property} value={property}>
                  {property}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Phòng</label>
            <select
              value={roomFilter}
              onChange={e => setRoomFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tất cả phòng</option>
              {roomOptions.map(room => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
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
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {totalUnpaid > 0 && (
        <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          Chưa thu:
          {' '}
          <span className="font-medium">{formatVnd(totalUnpaid)}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-gray-400">Đang t?i...</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium text-gray-600">Phòng</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Khu trọ</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Khách thuê</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Tháng</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Ngày trọ</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Hạn thanh toán</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Tổng tiền</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Trạng thái</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    Chưa có hóa đơn nào
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    {NO_MATCH_MESSAGE}
                  </td>
                </tr>
              ) : filteredInvoices.map(invoice => {
                const dueDate = resolveDueDate(invoice);

                return (
                  <tr key={invoice.id} className="transition hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{invoice.roomNumber}</td>
                    <td className="px-5 py-3 text-gray-700">{invoice.propertyName}</td>
                    <td className="px-5 py-3 text-gray-700">{invoice.tenantName}</td>
                    <td className="px-5 py-3 text-gray-600">{formatMonth(invoice.billingMonth)}</td>
                    <td className="px-5 py-3 text-gray-600">{formatDate(invoice.createdAt)}</td>
                    <td className="px-5 py-3 text-gray-600">{dueDate ? formatDate(dueDate.toISOString()) : '-'}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{formatVnd(invoice.totalAmount)}</td>
                    <td className="px-5 py-3">
                      <Badge
                        label={STATUS_LABELS[invoice.status]}
                        className={getInvoiceStatusColor(invoice.status)}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setDetailInvoice(invoice)}
                          title="Xem chi tiết"
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-gray-100"
                        >
                          <Eye className="h-3.5 w-3.5 text-gray-500" />
                        </button>

                        <button
                          onClick={() => handleDownloadPdf(invoice)}
                          disabled={pdfLoading === invoice.id}
                          title="Tải PDF"
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-blue-50"
                        >
                          {pdfLoading === invoice.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                          ) : (
                            <Download className="h-3.5 w-3.5 text-blue-400" />
                          )}
                        </button>

                        {canMarkAsPaid(invoice) && (
                          <button
                            onClick={() => markPaidMutation.mutate(invoice.id)}
                            disabled={markPaidMutation.isPending}
                            title="Đánh dấu đã thanh toán"
                            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-green-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteRequest(invoice)}
                          title="Xóa"
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal danh sách phòng chưa có hóa đơn tháng hiện tại */}
      <Modal
        open={pendingRoomsOpen}
        title={`Phòng chưa có hóa đơn — ${formatBillingMonthLabel(defaultBillingMonth)}`}
        onClose={() => setPendingRoomsOpen(false)}
        size="lg"
      >
        <div className="space-y-4">
          {pendingContracts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-2 text-4xl">✓</div>
              <p className="font-medium text-gray-700">Tất cả phòng đã có hóa đơn tháng này</p>
              <p className="mt-1 text-sm text-gray-400">Không còn phòng nào cần lập hóa đơn.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  {pendingContracts.length} phòng chưa lập hóa đơn
                </span>
                <button
                  type="button"
                  onClick={() => { setPendingRoomsOpen(false); openCreateModal(); }}
                  className="text-xs text-gray-400 underline hover:text-gray-600 transition"
                >
                  Tạo thủ công (tháng khác)
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Phòng</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Khu trọ</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Khách thuê</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Tiền thuê</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendingContracts.map(contract => (
                      <tr key={contract.id} className="transition hover:bg-amber-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{contract.roomNumber}</td>
                        <td className="px-4 py-3 text-gray-600">{contract.propertyName}</td>
                        <td className="px-4 py-3 text-gray-700">{contract.tenantName}</td>
                        <td className="px-4 py-3 text-gray-700">{formatVnd(contract.monthlyRent)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openCreateFromPending(contract)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-900"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tạo hóa đơn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Modal>

            <Modal open={modalOpen} title="Tạo hóa đơn mới" onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-4">
          <input type="hidden" {...register('contractId')} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Khu trọ</label>
              <select
                value={createPropertyId}
                onChange={(e) => handleCreatePropertyChange(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Chọn khu trọ --</option>
                {createPropertyOptions.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phòng</label>
              <select
                value={createRoomId}
                onChange={(e) => handleCreateRoomChange(e.target.value)}
                disabled={!createPropertyId}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">-- Chọn phòng --</option>
                {createRoomOptions.map((room) => (
                  <option key={room.id} value={room.id}>{room.roomNumber}</option>
                ))}
              </select>
              {createPropertyId && createRoomOptions.length === 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Không có phòng nào đang có hợp đồng hiệu lực tại khu này
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hợp đồng</label>
              <select
                value={watchedContractId || ''}
                onChange={(e) => handleCreateContractChange(e.target.value)}
                disabled={!createRoomId}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">-- Chọn hợp đồng --</option>
                {contractsForCreateRoom.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {`Phòng ${contract.roomNumber} - ${contract.tenantName} (${formatDate(contract.startDate)} -> ${formatDate(contract.endDate)})`}
                  </option>
                ))}
              </select>
              {contractsForCreateRoom.length > 1 && (
                <p className="mt-1 text-xs text-amber-600">
                  Phòng này đang có nhiều hợp đồng, vui lòng kiểm tra lại
                </p>
              )}
              {errors.contractId && <p className="mt-1 text-xs text-red-500">{errors.contractId.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tháng lập hóa đơn</label>
              <select
                {...register('billingMonth')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {billingMonthOptions.map((monthOption) => (
                  <option key={monthOption.value} value={monthOption.value}>
                    {monthOption.label}
                  </option>
                ))}
              </select>
              {errors.billingMonth && <p className="mt-1 text-xs text-red-500">{errors.billingMonth.message}</p>}
            </div>
          </div>

          {selectedContract && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="font-medium text-gray-800">
                Tiền phòng theo hợp đồng: {formatVnd(selectedContract.monthlyRent)}
              </div>
            </div>
          )}

          {duplicateInvoiceMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {duplicateInvoiceMessage}
            </div>
          )}

          {missingPreviousDataWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Không tìm thấy dữ liệu tháng trước, chỉ số đầu kỳ được đặt mặc định là 0
            </div>
          )}

          {electricUsageWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Chỉ số điện tháng này cao bất thường so với tháng trước, vui lòng kiểm tra lại
            </div>
          )}

          {waterUsageWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Chỉ số nước tháng này cao bất thường so với tháng trước, vui lòng kiểm tra lại
            </div>
          )}

          {selectedProperty && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-medium mb-1.5">Đơn giá niêm yết — {selectedProperty.name}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                <span>Điện: <b>{formatVnd(selectedProperty.electricUnitPrice)}/kWh</b></span>
                <span>Nước: <b>{formatVnd(selectedProperty.waterUnitPrice)}/m³</b></span>
                <span>Dịch vụ: <b>{formatVnd(selectedProperty.serviceUnitPrice)}/người</b></span>
                <span>Mạng: <b>{formatVnd(selectedProperty.networkFee)}/tháng</b></span>
              </div>
            </div>
          )}

          <div className="bg-yellow-50 rounded-xl p-4">
            <div className="text-sm font-medium text-yellow-800 mb-3">Điện</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Chỉ số đầu kỳ (kWh)</label>
                <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-500">
                  {electricOldDisplay}
                  <span className="ml-1 text-xs text-gray-400">
                    {previousMonthInvoice ? '(tháng trước)' : '(mặc định)'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Chỉ số cuối kỳ (kWh)</label>
                <input
                  {...register('electricNew')}
                  type="number" min={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.electricNew && <p className="text-red-500 text-xs mt-1">{errors.electricNew.message}</p>}
              </div>
            </div>
            {currentElectricUsed > 0 && (
              <p className="mt-1.5 text-xs text-yellow-700">
                Sử dụng: {currentElectricUsed} kWh × {formatVnd(selectedProperty?.electricUnitPrice ?? 0)} = <b>{formatVnd(electricFeePreview)}</b>
              </p>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-sm font-medium text-blue-800 mb-3">Nước</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Chỉ số đầu kỳ (m³)</label>
                <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-500">
                  {waterOldDisplay}
                  <span className="ml-1 text-xs text-gray-400">
                    {previousMonthInvoice ? '(tháng trước)' : '(mặc định)'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Chỉ số cuối kỳ (m³)</label>
                <input
                  {...register('waterNew')}
                  type="number" min={0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.waterNew && <p className="text-red-500 text-xs mt-1">{errors.waterNew.message}</p>}
              </div>
            </div>
            {currentWaterUsed > 0 && (
              <p className="mt-1.5 text-xs text-blue-700">
                Sử dụng: {currentWaterUsed} m³ × {formatVnd(selectedProperty?.waterUnitPrice ?? 0)} = <b>{formatVnd(waterFeePreview)}</b>
              </p>
            )}
          </div>

          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="text-sm font-medium text-emerald-800 mb-3">Dịch vụ chung (thang máy, máy giặt, vệ sinh)</div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Số người</label>
              <input
                {...register('servicePeople')}
                type="number" min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.servicePeople && <p className="text-red-500 text-xs mt-1">{errors.servicePeople.message}</p>}
              {watchedServicePeople > 0 && selectedProperty && (
                <p className="mt-1.5 text-xs text-emerald-700">
                  {watchedServicePeople} người × {formatVnd(selectedProperty.serviceUnitPrice)} = <b>{formatVnd(serviceFeePreview)}</b>
                </p>
              )}
            </div>
          </div>

          {selectedProperty && selectedProperty.networkFee > 0 && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
              Phí mạng internet: <b>{formatVnd(selectedProperty.networkFee)}/tháng</b>
            </div>
          )}

          {selectedContract && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
              <div className="flex justify-between items-center text-gray-600">
                <span>Tiền phòng:</span>
                <span className="font-medium">{formatVnd(selectedContract.monthlyRent)}</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-base font-semibold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                <span>Dự tính tổng cộng:</span>
                <span className="text-primary-800">{formatVnd(totalPreview)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm rounded-xl bg-primary-800 text-white hover:bg-primary-900 disabled:opacity-50 transition flex items-center gap-2"
            >
              {createMutation.isPending && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Tạo hóa đơn
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!detailInvoice}
        title={`Chi tiết hóa đơn #${detailInvoice?.id}`}
        onClose={() => setDetailInvoice(null)}
      >
        {detailInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Phòng</div>
                <div className="font-medium">{detailInvoice.roomNumber}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Khu trọ</div>
                <div className="font-medium">{detailInvoice.propertyName}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Khách thuê</div>
                <div className="font-medium">{detailInvoice.tenantName}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">Tháng</div>
                <div className="font-medium">T{formatMonth(detailInvoice.billingMonth)}</div>
              </div>
            </div>

            {detailInvoice.status === 'PAID' && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-emerald-50 rounded-xl p-3">
                  <div className="text-xs text-emerald-700 mb-1">Ngày thanh toán thực tế</div>
                  <div className="font-medium text-emerald-900">
                    {detailInvoice.paidAt ? formatDate(detailInvoice.paidAt) : 'Không có dữ liệu'}
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <div className="text-xs text-emerald-700 mb-1">Người xác nhận</div>
                  <div className="font-medium text-emerald-900">
                    {detailInvoice.paymentConfirmedBy || 'Không có dữ liệu'}
                  </div>
                </div>
              </div>
            )}

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">Chi tiết khoản thu</div>
              <div className="divide-y divide-gray-50">
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-600">Tiền phòng</span>
                  <span className="font-medium">{formatVnd(detailInvoice.roomFee)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-600">
                    Tiền điện (
                    {detailInvoice.electricOld}
                    {' '}
                    {'->'}
                    {' '}
                    {detailInvoice.electricNew}
                    {' '}
                    =
                    {' '}
                    {detailInvoice.electricUsed}
                    {' '}
                    kWh x
                    {' '}
                    {formatVnd(detailInvoice.electricUnitPrice)}
                    )
                  </span>
                  <span className="font-medium">{formatVnd(detailInvoice.electricFee)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-600">
                    Tiền nước (
                    {detailInvoice.waterOld}
                    {' '}
                    {'->'}
                    {' '}
                    {detailInvoice.waterNew}
                    {' '}
                    =
                    {' '}
                    {detailInvoice.waterUsed}
                    {' '}
                    m3 x
                    {' '}
                    {formatVnd(detailInvoice.waterUnitPrice)}
                    )
                  </span>
                  <span className="font-medium">{formatVnd(detailInvoice.waterFee)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-600">
                    Phí dịch vụ (
                    {detailInvoice.servicePeople}
                    {' '}
                    người x
                    {' '}
                    {formatVnd(detailInvoice.serviceUnitPrice)}
                    )
                  </span>
                  <span className="font-medium">{formatVnd(detailInvoice.serviceFee)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-600">
                    Phí mạng (1 tháng x
                    {' '}
                    {formatVnd(detailInvoice.networkUnitPrice)}
                    )
                  </span>
                  <span className="font-medium">{formatVnd(detailInvoice.networkFee)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 bg-gray-50">
                  <span className="font-medium text-gray-900">Tổng cộng</span>
                  <span className="font-medium text-lg text-primary-800">{formatVnd(detailInvoice.totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Badge
                label={STATUS_LABELS[detailInvoice.status]}
                className={getInvoiceStatusColor(detailInvoice.status)}
              />
              <button
                onClick={() => handleDownloadPdf(detailInvoice)}
                disabled={pdfLoading === detailInvoice.id}
                className="flex items-center gap-2 px-4 py-2 bg-primary-800 text-white rounded-xl text-sm hover:bg-primary-900 transition"
              >
                {pdfLoading === detailInvoice.id
                  ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Download className="w-4 h-4" />}
                Tải PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa hóa đơn"
        message={`Xóa hóa đơn tháng ${deleteTarget ? formatMonth(deleteTarget.billingMonth) : ''} của phòng ${deleteTarget?.roomNumber}?`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={duplicateConfirmOpen}
        title="Xác nhận tạo thêm hóa đơn"
        message={duplicateInvoiceMessage ?? 'Hóa đơn tháng này đã tồn tại. Bạn có chắc muốn tiếp tục?'}
        onConfirm={handleConfirmDuplicateCreate}
        onClose={() => {
          setDuplicateConfirmOpen(false);
          setPendingCreateForm(null);
        }}
        loading={createMutation.isPending}
      />
    </div>
  );
}






