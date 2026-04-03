export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  role: string;
}

export interface Property {
  id: number;
  name: string;
  address: string;
  description?: string;
  ownerId: number;
  ownerUsername: string;
  totalRooms: number;
  createdAt: string;
}

export interface Room {
  id: number;
  roomNumber: string;
  price: number;
  area: number;
  description?: string | null;
  imageUrl?: string | null;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  propertyId: number;
  propertyName: string;
  createdAt: string;
}

export interface Tenant {
  id: number;
  fullName: string;
  phone: string;
  email?: string;
  idCardNumber?: string;
  createdAt: string;
}

export interface Contract {
  id: number;
  propertyId: number;
  propertyName: string;
  roomId: number;
  roomNumber: string;
  tenantId: number;
  tenantName: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  createdAt: string;
}

export interface Invoice {
  id: number;
  contractId: number;
  tenantName: string;
  roomNumber: string;
  propertyName: string;
  billingMonth: string;
  roomFee: number;
  electricOld: number;
  electricNew: number;
  electricUsed: number;
  electricUnitPrice: number;
  electricFee: number;
  waterOld: number;
  waterNew: number;
  waterUsed: number;
  waterUnitPrice: number;
  waterFee: number;
  servicePeople: number;
  serviceUnitPrice: number;
  serviceFee: number;
  networkUnitPrice: number;
  networkFee: number;
  totalAmount: number;
  status: 'UNPAID' | 'PAID' | 'OVERDUE';
  dueDate?: string | null;
  paidAt?: string | null;
  paymentConfirmedBy?: string | null;
  notificationSent?: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
