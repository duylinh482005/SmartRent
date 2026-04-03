import axiosClient from './axiosClient';
import type { ApiResponse, Property } from '../types';

export interface PropertyRequest {
  name: string;
  address: string;
  description?: string;
  ownerId: number;
}

export const propertyApi = {
  getAll:         ()                              => axiosClient.get<ApiResponse<Property[]>>('/properties'),
  getById:        (id: number)                   => axiosClient.get<ApiResponse<Property>>(`/properties/${id}`),
  create:         (data: PropertyRequest)        => axiosClient.post<ApiResponse<Property>>('/properties', data),
  update:         (id: number, data: PropertyRequest) => axiosClient.put<ApiResponse<Property>>(`/properties/${id}`, data),
  delete:         (id: number)                   => axiosClient.delete<ApiResponse<void>>(`/properties/${id}`),
};