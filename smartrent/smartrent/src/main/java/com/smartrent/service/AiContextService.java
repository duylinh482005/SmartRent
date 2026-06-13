package com.smartrent.service;

import com.smartrent.dto.response.AiAlertsResponse;

public interface AiContextService {
    String buildContext();
    AiAlertsResponse buildAlerts();
}