package com.smartrent.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiChatResponse {
    private String question;
    private String answer;
}