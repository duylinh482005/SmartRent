import axiosClient from './axiosClient';
import type { ApiResponse } from '../types';

export interface AiChatResponse {
  question: string;
  answer: string;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  chat: (message: string, history?: ChatHistoryItem[]) =>
    axiosClient.post<ApiResponse<AiChatResponse>>('/ai/chat', { message, history }),
};
