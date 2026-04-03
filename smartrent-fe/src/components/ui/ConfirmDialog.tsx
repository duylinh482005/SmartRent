import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({ open, title, message, onConfirm, onClose, loading }: Props) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <div className="flex gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mt-2">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition">
          Hủy
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Xác nhận xóa
        </button>
      </div>
    </Modal>
  );
}