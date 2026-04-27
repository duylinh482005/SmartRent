import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Plus, Pencil, Trash2, MapPin, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { propertyApi } from '../api/propertyApi';
import type { PropertyRequest } from '../api/propertyApi';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import type { Property } from '../types';

const schema = z.object({
  name:        z.string().min(1, 'Tên khu trọ không được để trống'),
  address:     z.string().min(1, 'Địa chỉ không được để trống'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function PropertyPage() {
  const queryClient               = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null); // usestate là hook thay đổi dữ liệu, property kiểu dữ liệu
  const [editing, setEditing]     = useState<Property | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn:  () => propertyApi.getAll(),
  });

  const properties = data?.data.data ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const openCreate = () => { setEditing(null); reset({}); setModalOpen(true); };
  const openEdit   = (p: Property) => { setEditing(p); reset({ name: p.name, address: p.address, description: p.description }); setModalOpen(true); };

  const saveMutation = useMutation({ // hook thay đổi dữ liệu (react query)
    mutationFn: (data: FormData) => { // nhận data từ form
      const payload: PropertyRequest = { ...data, ownerId: 1 }; // ownerId tạm = 1 // spread data rồi them id
      return editing
        ? propertyApi.update(editing.id, payload)
        : propertyApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật thành công!' : 'Tạo khu trọ thành công!');
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => propertyApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa khu trọ');
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="p-6">
      <PageHeader
        icon={Building2}
        title="Khu trọ"
        subtitle={`${properties.length} khu trọ`}
        action={
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-primary-800 text-white px-4 py-2 rounded-xl text-sm hover:bg-primary-900 transition">
            <Plus className="w-4 h-4" /> Thêm khu trọ
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {properties.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-700" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => setDeleteTarget(p)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">{p.name}</h3>
              <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{p.address}</span>
              </div>
              {p.description && (
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center gap-1 text-xs text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg w-fit">
                <DoorOpen className="w-3 h-3" />
                <span>{p.totalRooms} phòng</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal tạo/sửa */}
      <Modal
        open={modalOpen}
        title={editing ? 'Cập nhật khu trọ' : 'Thêm khu trọ mới'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên khu trọ</label>
            <input {...register('name')} placeholder="VD: Khu trọ Bình Thạnh"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input {...register('address')} placeholder="VD: 123 Nguyễn Trãi, Q.1, TP.HCM"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
            <textarea {...register('description')} rows={3} placeholder="Mô tả thêm về khu trọ..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition">
              Hủy
            </button>
            <button type="submit" disabled={saveMutation.isPending}
              className="px-4 py-2 text-sm rounded-xl bg-primary-800 text-white hover:bg-primary-900 disabled:opacity-50 transition flex items-center gap-2">
              {saveMutation.isPending && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editing ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm xóa */}
      <ConfirmDialog
        open={!!deleteTarget} // chuyển object thành boolean, nếu có đối tượng thì mở dialog
        title="Xóa khu trọ"
        message={`Bạn có chắc muốn xóa khu trọ "${deleteTarget?.name}"? Hành động này không thể hoàn tác.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
