import axiosClient from './axiosClient';
import type { ApiResponse, AuthResponse } from '../types';

export const authApi = {
  login: (username: string, password: string) =>
    axiosClient.post<ApiResponse<AuthResponse>>('/auth/login', { username, password }),

  register: (username: string, password: string, email: string) =>
    axiosClient.post<ApiResponse<AuthResponse>>('/auth/register', { username, password, email }),
};