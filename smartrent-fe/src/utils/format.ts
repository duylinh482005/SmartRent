export const formatVnd = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(dateStr));
};

export const formatMonth = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month] = dateStr.split('-');
  return `${month}/${year}`;
};

export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr));
};

export const getRoomStatusColor = (status: string) => {
  switch (status) {
    case 'AVAILABLE':   return 'bg-green-100 text-green-700';
    case 'OCCUPIED':    return 'bg-blue-100 text-blue-700';
    case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-700';
    default:            return 'bg-gray-100 text-gray-700';
  }
};

export const getInvoiceStatusColor = (status: string) => {
  switch (status) {
    case 'PAID':     return 'bg-green-100 text-green-700';
    case 'UNPAID':   return 'bg-gray-100 text-gray-700';
    case 'DUE_SOON': return 'bg-amber-100 text-amber-700';
    case 'OVERDUE':  return 'bg-red-100 text-red-700';
    default:         return 'bg-gray-100 text-gray-700';
  }
};

export const getContractStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':     return 'bg-green-100 text-green-700';
    case 'EXPIRED':    return 'bg-gray-100 text-gray-700';
    case 'TERMINATED': return 'bg-red-100 text-red-700';
    default:           return 'bg-gray-100 text-gray-700';
  }
};