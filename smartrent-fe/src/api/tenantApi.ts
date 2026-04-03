import axiosClient from './axiosClient';
import type { ApiResponse, Tenant } from '../types';

export interface TenantRequest {
  fullName: string;
  phone: string;
  email?: string;
  idCardNumber?: string;
}

export const tenantApi = {
  getAll:  ()                                  => axiosClient.get<ApiResponse<Tenant[]>>('/tenants'),
  getById: (id: number)                        => axiosClient.get<ApiResponse<Tenant>>(`/tenants/${id}`),
  create:  (data: TenantRequest)               => axiosClient.post<ApiResponse<Tenant>>('/tenants', data),
  update:  (id: number, data: TenantRequest)   => axiosClient.put<ApiResponse<Tenant>>(`/tenants/${id}`, data),
  delete:  (id: number)                        => axiosClient.delete<ApiResponse<void>>(`/tenants/${id}`),
};