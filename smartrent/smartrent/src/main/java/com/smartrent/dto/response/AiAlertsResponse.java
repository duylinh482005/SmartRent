package com.smartrent.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AiAlertsResponse {
    private int badgeCount;
    private List<AlertItem> alerts;

    @Data
    @Builder
    public static class AlertItem {
        private String type;
        private String message;
        private String aiMessage;
    }
}
