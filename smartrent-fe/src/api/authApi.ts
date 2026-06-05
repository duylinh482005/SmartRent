import axiosClient from './axiosClient';
import type { ApiResponse, AuthResponse, UserProfile } from '../types';

export const authApi = {
  login: (username: string, password: string) =>
    axiosClient.post<ApiResponse<AuthResponse>>('/auth/login', { username, password }),

  register: (username: string, password: string, email: string) =>
    axiosClient.post<ApiResponse<AuthResponse>>('/auth/register', { username, password, email }),

  getProfile: () =>
    axiosClient.get<ApiResponse<UserProfile>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    axiosClient.patch<ApiResponse<null>>('/auth/change-password', { currentPassword, newPassword }),

  updatePaymentInfo: (data: {
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    qrCodeUrl?: string;
  }) =>
    axiosClient.patch<ApiResponse<UserProfile>>('/auth/payment-info', data),

  uploadQrImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return axiosClient.post<ApiResponse<string>>('/uploads/qr', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
