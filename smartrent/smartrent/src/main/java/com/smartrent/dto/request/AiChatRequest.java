package com.smartrent.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class AiChatRequest {

    @NotBlank(message = "Câu hỏi không được để trống")
    private String message;

    private List<ChatHistoryItem> history;

    @Data
    public static class ChatHistoryItem {
        private String role;    // "user" or "assistant"
        private String content;
    }
}