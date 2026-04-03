package com.smartrent.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AiChatRequest {

    @NotBlank(message = "Câu hỏi không được để trống")
    private String message;
}