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

export interface AiAlertItem {
  type: 'OVERDUE' | 'EXPIRING' | 'MISSING_INVOICE';
  message: string;
  aiMessage: string;
}

export interface AiAlertsResponse {
  badgeCount: number;
  alerts: AiAlertItem[];
}

export const aiApi = {
  chat: (message: string, history?: ChatHistoryItem[]) =>
    axiosClient.post<ApiResponse<AiChatResponse>>('/ai/chat', { message, history }),
  getAlerts: () =>
    axiosClient.get<ApiResponse<AiAlertsResponse>>('/ai/alerts'),
};
