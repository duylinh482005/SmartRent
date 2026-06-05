package com.smartrent.dto.response;

import com.smartrent.entity.Invoice;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class InvoiceResponse {
    private Long id;
    private Long contractId;
    private String tenantName;
    private String roomNumber;
    private String propertyName;

    private LocalDate billingMonth;

    // Chi tiết
    private BigDecimal depositFee;
    private BigDecimal roomFee;
    private Integer electricOld;
    private Integer electricNew;
    private Integer electricUsed;
    private BigDecimal electricUnitPrice;
    private BigDecimal electricFee;

    private Integer waterOld;
    private Integer waterNew;
    private Integer waterUsed;
    private BigDecimal waterUnitPrice;
    private BigDecimal waterFee;

    private Integer servicePeople;
    private BigDecimal serviceUnitPrice;
    private BigDecimal serviceFee;

    private BigDecimal networkUnitPrice;
    private BigDecimal networkFee;

    private BigDecimal totalAmount;
    private BigDecimal lateFee;
    private int overdueDays;
    private BigDecimal totalWithLateFee;
    private Invoice.Status status;
    private LocalDate dueDate;
    private LocalDateTime paidAt;
    private String paymentConfirmedBy;
    private Boolean notificationSent;
    private LocalDateTime createdAt;
}
