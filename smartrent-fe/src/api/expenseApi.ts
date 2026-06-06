import axiosClient from './axiosClient';
import type { ApiResponse, Expense, ExpenseCategory } from '../types';

export interface ExpenseRequest {
  propertyId: number;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  receiptImageUrl?: string | null;
}

export const expenseApi = {
  getAll: (params?: { propertyId?: number; from?: string; to?: string }) =>
    axiosClient.get<ApiResponse<Expense[]>>('/expenses', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<Expense>>(`/expenses/${id}`),
  create: (data: ExpenseRequest) =>
    axiosClient.post<ApiResponse<Expense>>('/expenses', data),
  update: (id: number, data: ExpenseRequest) =>
    axiosClient.put<ApiResponse<Expense>>(`/expenses/${id}`, data),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>>(`/expenses/${id}`),
};
