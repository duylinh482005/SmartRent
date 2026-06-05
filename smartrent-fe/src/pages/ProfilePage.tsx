import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays, KeyRound, Mail, ShieldCheck, UserCircle2,
  CreditCard, QrCode, Upload, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRef, useState } from 'react';
import { authApi } from '../api/authApi';
import PageHeader from '../components/ui/PageHeader';

// ── Password change form ─────────────────────────────────────────────
const pwdSchema = z.object({
  currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});
type PwdForm = z.infer<typeof pwdSchema>;

// ── Payment info form ────────────────────────────────────────────────
const paySchema = z.object({
  bankName:          z.string().max(100).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankAccountName:   z.string().max(100).optional(),
});
type PayForm = z.infer<typeof paySchema>;

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [pendingQrUrl, setPendingQrUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['auth-profile'],
    queryFn: () => authApi.getProfile(),
  });
  const profile = data?.data.data;
  const avatarLetter = profile?.username ? profile.username.charAt(0).toUpperCase() : '?';

  // ── Password form ────────────────────────────────────────────────
  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErr } } =
    useForm<PwdForm>({ resolver: zodResolver(pwdSchema) });

  const changePwdMut = useMutation({
    mutationFn: (f: PwdForm) => authApi.changePassword(f.currentPassword, f.newPassword),
    onSuccess: () => { toast.success('Đổi mật khẩu thành công'); resetPwd(); },
  });

  // ── Payment info form ────────────────────────────────────────────
  const { register: regPay, handleSubmit: handlePay, formState: { errors: payErr } } =
    useForm<PayForm>({
      resolver: zodResolver(paySchema),
      values: {
        bankName:          profile?.bankName ?? '',
        bankAccountNumber: profile?.bankAccountNumber ?? '',
        bankAccountName:   profile?.bankAccountName ?? '',
      },
    });

  const uploadQrMut = useMutation({
    mutationFn: (file: File) => authApi.uploadQrImage(file),
    onSuccess: (res) => {
      const url = res.data.data;
      setPendingQrUrl(url);
      toast.success('Đã tải ảnh QR lên');
    },
    onError: () => toast.error('Tải ảnh QR thất bại'),
  });

  const savePayMut = useMutation({
    mutationFn: (f: PayForm) =>
      authApi.updatePaymentInfo({ ...f, qrCodeUrl: pendingQrUrl ?? profile?.qrCodeUrl ?? undefined }),
    onSuccess: () => {
      toast.success('Đã lưu thông tin thanh toán');
      qc.invalidateQueries({ queryKey: ['auth-profile'] });
      setPendingQrUrl(null);
      setQrPreview(null);
    },
    onError: () => toast.error('Lưu thất bại'),
  });

  function handleQrFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrPreview(URL.createObjectURL(file));
    uploadQrMut.mutate(file);
  }

  function clearQr() {
    setPendingQrUrl('');
    setQrPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const currentQrUrl = qrPreview ?? profile?.qrCodeUrl ?? null;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        icon={UserCircle2}
        title="Hồ sơ cá nhân"
        subtitle="Xem thông tin tài khoản, đổi mật khẩu và cài đặt thông tin thanh toán"
      />

      {/* Row 1: Account info + Change password */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">

        {/* Account info */}
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
              <InfoCard icon={UserCircle2} label="Username"  value={profile?.username} />
              <InfoCard icon={Mail}        label="Email"     value={profile?.email} />
              <InfoCard icon={ShieldCheck} label="Vai trò"   value={profile?.role} />
              <InfoCard icon={CalendarDays} label="Ngày tạo" value={formatDateTime(profile?.createdAt)} />
              <div className="sm:col-span-2">
                <InfoCard icon={CalendarDays} label="Cập nhật gần nhất" value={formatDateTime(profile?.updatedAt)} />
              </div>
            </div>
          )}
        </section>

        {/* Change password */}
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
          <form onSubmit={handlePwd(d => changePwdMut.mutate(d))} className="space-y-4">
            <Field label="Mật khẩu hiện tại" error={pwdErr.currentPassword?.message}>
              <input {...regPwd('currentPassword')} type="password"
                className={inputCls} placeholder="Nhập mật khẩu hiện tại" />
            </Field>
            <Field label="Mật khẩu mới" error={pwdErr.newPassword?.message}>
              <input {...regPwd('newPassword')} type="password"
                className={inputCls} placeholder="Tối thiểu 6 ký tự" />
            </Field>
            <Field label="Xác nhận mật khẩu mới" error={pwdErr.confirmPassword?.message}>
              <input {...regPwd('confirmPassword')} type="password"
                className={inputCls} placeholder="Nhập lại mật khẩu mới" />
            </Field>
            <SubmitBtn loading={changePwdMut.isPending} label="Cập nhật mật khẩu" />
          </form>
        </section>
      </div>

      {/* Row 2: Payment info full width */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Thông tin thanh toán & Mã QR</h2>
            <p className="text-sm text-gray-500">
              Thông tin này sẽ được in vào PDF hóa đơn để khách thuê tiện chuyển khoản
            </p>
          </div>
        </div>

        <form onSubmit={handlePay(d => savePayMut.mutate(d))}
              className="p-6 grid gap-6 md:grid-cols-[1fr,auto]">

          {/* Left: bank fields */}
          <div className="space-y-4">
            <Field label="Tên ngân hàng" error={payErr.bankName?.message}
                   hint="Ví dụ: MB Bank, Vietcombank, Techcombank">
              <input {...regPay('bankName')} type="text"
                className={inputCls} placeholder="MB Bank" />
            </Field>
            <Field label="Số tài khoản" error={payErr.bankAccountNumber?.message}>
              <input {...regPay('bankAccountNumber')} type="text"
                className={inputCls} placeholder="0123456789" />
            </Field>
            <Field label="Tên chủ tài khoản" error={payErr.bankAccountName?.message}
                   hint="Nhập chính xác như trong tài khoản ngân hàng">
              <input {...regPay('bankAccountName')} type="text"
                className={inputCls} placeholder="NGUYEN VAN A" />
            </Field>
            <SubmitBtn
              loading={savePayMut.isPending || uploadQrMut.isPending}
              label="Lưu thông tin thanh toán"
            />
          </div>

          {/* Right: QR upload */}
          <div className="flex flex-col items-center gap-3 min-w-[160px]">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <QrCode className="w-4 h-4" /> Ảnh QR chuyển khoản
            </p>

            {currentQrUrl ? (
              <div className="relative">
                <img
                  src={currentQrUrl}
                  alt="QR thanh toán"
                  className="w-36 h-36 object-contain rounded-xl border border-gray-200 bg-gray-50"
                />
                <button type="button" onClick={clearQr}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-36 h-36 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition">
                <Upload className="w-7 h-7 text-gray-400" />
                <span className="text-xs text-gray-500 text-center px-2">
                  Tải ảnh QR<br />từ app ngân hàng
                </span>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*"
              className="hidden" onChange={handleQrFileChange} />

            {!currentQrUrl && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary-700 hover:underline">
                Chọn ảnh
              </button>
            )}
            {currentQrUrl && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary-700 hover:underline">
                Đổi ảnh khác
              </button>
            )}

            <p className="text-xs text-gray-400 text-center max-w-[140px]">
              Ảnh QR sẽ hiển thị trong phiếu PDF gửi cho khách
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

const inputCls =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <Icon className="w-4 h-4" />{label}
      </div>
      <div className="mt-2 text-sm font-medium text-gray-900 break-all">{value ?? '—'}</div>
    </div>
  );
}

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-800 text-white text-sm hover:bg-primary-900 disabled:opacity-50 transition">
      {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
      {label}
    </button>
  );
}
