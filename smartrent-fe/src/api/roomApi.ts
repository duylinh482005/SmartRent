import axiosClient from './axiosClient';
import type { ApiResponse, Room } from '../types';

export interface RoomRequest {
  roomNumber: string;
  price: number;
  area: number;
  description?: string | null;
  imageUrl?: string | null;
  propertyId: number;
}

export const roomApi = {
  getAll:          ()                              => axiosClient.get<ApiResponse<Room[]>>('/rooms'),
  uploadRoomImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post<ApiResponse<string>>('/uploads/rooms', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getByProperty:  (propertyId: number, status?: string) =>
    axiosClient.get<ApiResponse<Room[]>>(`/rooms/property/${propertyId}`, {
      params: status ? { status } : {},
    }),
  getById:        (id: number)                  => axiosClient.get<ApiResponse<Room>>(`/rooms/${id}`),
  create:         (data: RoomRequest)           => axiosClient.post<ApiResponse<Room>>('/rooms', data),
  update:         (id: number, data: RoomRequest) => axiosClient.put<ApiResponse<Room>>(`/rooms/${id}`, data),
  updateStatus:   (id: number, status: string)  => axiosClient.patch<ApiResponse<Room>>(`/rooms/${id}/status`, null, { params: { status } }),
  delete:         (id: number)                  => axiosClient.delete<ApiResponse<void>>(`/rooms/${id}`),
};
