import axiosClient from './axiosClient';
import type { ApiResponse } from '../types';

export interface AiChatResponse {
  question: string;
  answer: string;
}

export const aiApi = {
  chat: (message: string) =>
    axiosClient.post<ApiResponse<AiChatResponse>>('/ai/chat', { message }),
};