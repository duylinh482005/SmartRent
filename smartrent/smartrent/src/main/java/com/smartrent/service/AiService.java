package com.smartrent.service;

import com.smartrent.dto.response.AiChatResponse;

public interface AiService {
    AiChatResponse chat(String message);
}