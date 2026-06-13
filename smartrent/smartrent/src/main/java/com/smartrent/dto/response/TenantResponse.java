package com.smartrent.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TenantResponse {
    private Long id;
    private String fullName;
    private String phone;
    private String email;
    private String idCardNumber;
    private int latePaymentCount;
    private int totalLateDays;
    private LocalDateTime createdAt;
}