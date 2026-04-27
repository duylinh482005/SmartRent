import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, KeyRound, Mail, ShieldCheck, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api/authApi';
import PageHeader from '../components/ui/PageHeader';

const schema = z.object({
  currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProfilePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['auth-profile'],
    queryFn: () => authApi.getProfile(),
  });

  const profile = data?.data.data;
  const avatarLetter = profile?.username ? profile.username.charAt(0).toUpperCase() : '?';

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (form: FormData) => authApi.changePassword(form.currentPassword, form.newPassword),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công');
      reset();
    },
  });

  const onSubmit = (form: FormData) => {
    changePasswordMutation.mutate(form);
  };

  return (
    <div className="p-6">
      <PageHeader
        icon={UserCircle2}
        title="Hồ sơ cá nhân"
        subtitle="Xem thông tin tài khoản đang đăng nhập và đổi mật khẩu"
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-800 flex items-center justify-center text-xl font-semibold">
                {avatarLetter}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Thông tin đăng nhập</h2>
                <p className="text-sm text-gray-500">Dữ liệu lấy từ tài khoản hiện tại</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-10 text-sm text-gray-400">Đang tải thông tin tài khoản...</div>
          ) : (
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <UserCircle2 className="w-4 h-4" />
                  Username
                </div>
                <div className="mt-2 text-sm font-medium text-gray-900">{profile?.username ?? '—'}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
                <div className="mt-2 text-sm font-medium text-gray-900 break-all">{profile?.email ?? '—'}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <ShieldCheck className="w-4 h-4" />
                  Vai trò
                </div>
                <div className="mt-2 text-sm font-medium text-gray-900">{profile?.role ?? '—'}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <CalendarDays className="w-4 h-4" />
                  Ngày tạo
                </div>
                <div className="mt-2 text-sm font-medium text-gray-900">{formatDateTime(profile?.createdAt)}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 sm:col-span-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <CalendarDays className="w-4 h-4" />
                  Cập nhật gần nhất
                </div>
                <div className="mt-2 text-sm font-medium text-gray-900">{formatDateTime(profile?.updatedAt)}</div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary-800" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Đổi mật khẩu</h2>
              <p className="text-sm text-gray-500">Nhập mật khẩu hiện tại để xác nhận thay đổi</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
              <input
                {...register('currentPassword')}
                type="password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Nhập mật khẩu hiện tại"
              />
              {errors.currentPassword && <p className="text-red-500 text-xs mt-1">{errors.currentPassword.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
              <input
                {...register('newPassword')}
                type="password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Tối thiểu 6 ký tự"
              />
              {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
              <input
                {...register('confirmPassword')}
                type="password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Nhập lại mật khẩu mới"
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-800 text-white text-sm hover:bg-primary-900 disabled:opacity-50 transition"
            >
              {changePasswordMutation.isPending && (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Cập nhật mật khẩu
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
