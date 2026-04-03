import axiosClient from './axiosClient';
import type { ApiResponse, Invoice } from '../types';

export interface InvoiceRequest {
  contractId: number;
  billingMonth: string;
  electricOld: number;
  electricNew: number;
  waterOld: number;
  waterNew: number;
  electricUnitPrice?: number;
  waterUnitPrice?: number;
  servicePeople: number;
  serviceUnitPrice?: number;
  networkUnitPrice?: number;
}

export const invoiceApi = {
  getAll:     (status?: string) =>
    axiosClient.get<ApiResponse<Invoice[]>>('/invoices', {
      params: status ? { status } : {},
    }),
  getById:    (id: number)      => axiosClient.get<ApiResponse<Invoice>>(`/invoices/${id}`),
  getByContract: (contractId: number) =>
    axiosClient.get<ApiResponse<Invoice[]>>(`/invoices/contract/${contractId}`),
  create:     (data: InvoiceRequest) =>
    axiosClient.post<ApiResponse<Invoice>>('/invoices', data),
  markAsPaid: (id: number)      =>
    axiosClient.patch<ApiResponse<Invoice>>(`/invoices/${id}/mark-paid`),
  delete:     (id: number)      =>
    axiosClient.delete<ApiResponse<void>>(`/invoices/${id}`),
  downloadPdf: (id: number)     =>
    axiosClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
};
