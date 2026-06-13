package com.smartrent.controller;

import com.smartrent.dto.request.AiChatRequest;
import com.smartrent.dto.response.AiAlertsResponse;
import com.smartrent.dto.response.AiChatResponse;
import com.smartrent.service.AiService;
import com.smartrent.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<AiChatResponse>> chat(
            @Valid @RequestBody AiChatRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success(aiService.chat(request.getMessage(), request.getHistory())));
    }

    @GetMapping("/alerts")
    public ResponseEntity<ApiResponse<AiAlertsResponse>> getAlerts() {
        return ResponseEntity.ok(ApiResponse.success(aiService.getAlerts()));
    }
}