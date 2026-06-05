package com.smartrent.dto.request;

import lombok.Data;

@Data
public class UpdatePaymentInfoRequest {
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;
    private String qrCodeUrl;
}
