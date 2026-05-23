package com.smartrent.service;

import com.smartrent.dto.request.AiChatRequest;
import com.smartrent.dto.response.AiChatResponse;

import java.util.List;

public interface AiService {
    AiChatResponse chat(String message, List<AiChatRequest.ChatHistoryItem> history);
}