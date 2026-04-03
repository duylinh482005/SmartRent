import { useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DoorOpen, Plus, Pencil, Trash2, Filter, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { roomApi } from '../api/roomApi';
import type { RoomRequest } from '../api/roomApi';
import { propertyApi } from '../api/propertyApi';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import type { Room } from '../types';
import { formatVnd, getRoomStatusColor } from '../utils/format';

const schema = z.object({
  roomNumber: z.string().min(1, 'Số phòng không được để trống'),
  price: z.coerce.number().min(1, 'Giá thuê phải lớn hơn 0'),
  area: z.coerce.number().min(1, 'Diện tích phải lớn hơn 0'),
  description: z.string().max(2000, 'Chi tiết phòng tối đa 2000 ký tự').optional(),
  propertyId: z.coerce.number().min(1, 'Vui lòng chọn khu trọ'),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Còn trống',
  OCCUPIED: 'Đang thuê',
  MAINTENANCE: 'Bảo trì',
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    reader.readAsDataURL(file);
  });

export default function RoomPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [detailTarget, setDetailTarget] = useState<Room | null>(null);
  const [editing, setEditing] = useState<Room | null>(null);
  const [statusDraft, setStatusDraft] = useState<'AVAILABLE' | 'MAINTENANCE'>('AVAILABLE');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState<string | null>(null);
  const [imageFileDraft, setImageFileDraft] = useState<File | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [filterProperty, setFilterProperty] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data: propertiesRes } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyApi.getAll(),
  });
  const properties = propertiesRes?.data.data ?? [];

  const { data: roomsRes, isLoading } = useQuery({
    queryKey: ['rooms', filterProperty, filterStatus],
    queryFn: () =>
      filterProperty
        ? roomApi.getByProperty(filterProperty, filterStatus || undefined)
        : Promise.resolve({ data: { data: [] as Room[], success: true, message: '' } }),
    enabled: !!filterProperty,
  });
  const rooms = roomsRes?.data.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
  });

  const openCreate = () => {
    setEditing(null);
    setStatusDraft('AVAILABLE');
    setImagePreview(null);
    setImageUrlDraft(null);
    setImageFileDraft(null);
    setImageName('');
    reset({ propertyId: filterProperty || undefined, description: '' });
    setModalOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditing(room);
    setStatusDraft(room.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE');
    setImagePreview(room.imageUrl ?? null);
    setImageUrlDraft(room.imageUrl ?? null);
    setImageFileDraft(null);
    setImageName(room.imageUrl ? 'Ảnh hiện tại' : '');
    reset({
      roomNumber: room.roomNumber,
      price: room.price,
      area: room.area,
      description: room.description ?? '',
      propertyId: room.propertyId,
    });
    setModalOpen(true);
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Ảnh tối đa 2MB');
      e.target.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImagePreview(dataUrl);
      setImageFileDraft(file);
      setImageName(file.name);
    } catch {
      toast.error('Không thể đọc ảnh đã chọn');
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      let finalImageUrl = imageUrlDraft;

      if (imageFileDraft) {
        const uploadRes = await roomApi.uploadRoomImage(imageFileDraft);
        finalImageUrl = uploadRes.data.data;
      }

      const payload: RoomRequest = {
        ...data,
        description: data.description?.trim() || null,
        imageUrl: finalImageUrl,
      };

      if (!editing) return roomApi.create(payload);

      const updatedRoom = await roomApi.update(editing.id, payload);
      const canUpdateMaintenanceStatus = editing.status !== 'OCCUPIED' && statusDraft !== editing.status;

      if (canUpdateMaintenanceStatus) {
        await roomApi.updateStatus(editing.id, statusDraft);
      }

      return updatedRoom;
    },
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Tạo phòng thành công!');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setImagePreview(null);
      setImageUrlDraft(null);
      setImageFileDraft(null);
      setImageName('');
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => roomApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa phòng');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="p-6">
      <PageHeader
        icon={DoorOpen}
        title="Quản lý phòng"
        subtitle={`${rooms.length} phòng`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary-800 text-white px-4 py-2 rounded-xl text-sm hover:bg-primary-900 transition"
          >
            <Plus className="w-4 h-4" /> Thêm phòng
          </button>
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterProperty}
            onChange={e => setFilterProperty(e.target.value ? Number(e.target.value) : '')}
            className="text-sm text-gray-700 outline-none bg-transparent"
          >
            <option value="">-- Chọn khu trọ --</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm text-gray-700 outline-none bg-white border border-gray-200 rounded-xl px-3 py-2"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="AVAILABLE">Còn trống</option>
          <option value="OCCUPIED">Đang thuê</option>
          <option value="MAINTENANCE">Bảo trì</option>
        </select>
      </div>

      {!filterProperty ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center justify-center h-48 text-gray-400 text-sm">
          Chọn khu trọ để xem danh sách phòng
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Đang tải...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Số phòng</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Khu trọ</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Giá thuê</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Diện tích</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-center px-5 py-3 font-medium text-gray-600">Chi tiết</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Không có phòng nào
                  </td>
                </tr>
              ) : (
                rooms.map(room => (
                  <tr key={room.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-gray-900">{room.roomNumber}</td>
                    <td className="px-5 py-3 text-gray-600">{room.propertyName}</td>
                    <td className="px-5 py-3 text-gray-900">{formatVnd(room.price)}</td>
                    <td className="px-5 py-3 text-gray-600">{room.area} m²</td>
                    <td className="px-5 py-3">
                      <Badge label={STATUS_LABELS[room.status]} className={getRoomStatusColor(room.status)} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => setDetailTarget(room)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-50 transition"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary-700" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEdit(room)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(room)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} title={editing ? 'Cập nhật phòng' : 'Thêm phòng mới'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(data => saveMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Khu trọ</label>
            <select
              {...register('propertyId')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">-- Chọn khu trọ --</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.propertyId && <p className="text-red-500 text-xs mt-1">{errors.propertyId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số phòng</label>
            <input
              {...register('roomNumber')}
              placeholder="VD: P101"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.roomNumber && <p className="text-red-500 text-xs mt-1">{errors.roomNumber.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá thuê (đ/tháng)</label>
              <input
                {...register('price')}
                type="number"
                placeholder="VD: 3000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diện tích (m²)</label>
              <input
                {...register('area')}
                type="number"
                placeholder="VD: 25"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chi tiết phòng</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Mô tả nội thất, tiện nghi, lưu ý..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh phòng</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-lg file:bg-primary-50 file:text-primary-700"
            />
            <p className="text-xs text-gray-500 mt-1">Hỗ trợ ảnh JPG/PNG, dung lượng tối đa 2MB.</p>
            {imageName && <p className="text-xs text-gray-500 mt-1">Đã chọn: {imageName}</p>}

            {imagePreview && (
              <div className="mt-3 border border-gray-200 rounded-xl p-3 bg-gray-50">
                <img src={imagePreview} alt="Xem trước ảnh phòng" className="w-full h-44 object-cover rounded-lg border border-gray-200" />
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageUrlDraft(null);
                      setImageFileDraft(null);
                      setImageName('');
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Xóa ảnh
                  </button>
                </div>
              </div>
            )}
          </div>

          {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái phòng</label>
              {editing.status === 'OCCUPIED' ? (
                <>
                  <div className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700">
                    {STATUS_LABELS[editing.status]}
                  </div>
                  <p className="text-xs text-amber-600 mt-1">Phòng đang có khách thuê nên không thể chuyển sang bảo trì.</p>
                </>
              ) : (
                <select
                  value={statusDraft}
                  onChange={e => setStatusDraft(e.target.value as 'AVAILABLE' | 'MAINTENANCE')}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="AVAILABLE">Còn trống</option>
                  <option value="MAINTENANCE">Bảo trì</option>
                </select>
              )}
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
              disabled={saveMutation.isPending}
              className="px-4 py-2 text-sm rounded-xl bg-primary-800 text-white hover:bg-primary-900 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saveMutation.isPending && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editing ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!detailTarget}
        title={detailTarget ? `Chi tiết phòng ${detailTarget.roomNumber}` : 'Chi tiết phòng'}
        onClose={() => setDetailTarget(null)}
      >
        {detailTarget && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Mô tả</p>
              <div className="min-h-20 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-700 whitespace-pre-line">
                {detailTarget.description?.trim() || 'Phòng chưa có mô tả.'}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Ảnh phòng</p>
              {detailTarget.imageUrl ? (
                <img
                  src={detailTarget.imageUrl}
                  alt={`Ảnh phòng ${detailTarget.roomNumber}`}
                  className="w-full max-h-80 object-cover rounded-xl border border-gray-200"
                />
              ) : (
                <div className="h-48 border border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                  Phòng chưa có ảnh.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa phòng"
        message={`Bạn có chắc muốn xóa phòng "${deleteTarget?.roomNumber}"?`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
