import axiosClient from './axiosClient';
import type { ApiResponse, Contract } from '../types';

export interface ContractRequest {
  roomId: number;
  tenantId: number;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  numberOfPeople?: number;
}

export interface ContractUpdateRequest {
  endDate?: string;
  monthlyRent?: number;
  numberOfPeople?: number;
}

export const contractApi = {
  getAll:      ()                                       => axiosClient.get<ApiResponse<Contract[]>>('/contracts'),
  getById:     (id: number)                             => axiosClient.get<ApiResponse<Contract>>(`/contracts/${id}`),
  getByRoom:   (roomId: number)                         => axiosClient.get<ApiResponse<Contract[]>>(`/contracts/room/${roomId}`),
  getByTenant: (tenantId: number)                       => axiosClient.get<ApiResponse<Contract[]>>(`/contracts/tenant/${tenantId}`),
  create:      (data: ContractRequest)                  => axiosClient.post<ApiResponse<Contract>>('/contracts', data),
  terminate:   (id: number)                             => axiosClient.patch<ApiResponse<Contract>>(`/contracts/${id}/terminate`),
  update:      (id: number, data: ContractUpdateRequest) => axiosClient.put<ApiResponse<Contract>>(`/contracts/${id}`, data),
  delete:      (id: number)                             => axiosClient.delete<ApiResponse<void>>(`/contracts/${id}`),
};
