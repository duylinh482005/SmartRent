package com.smartrent.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class InvoiceRequest {

    @NotNull(message = "ID hợp đồng không được để trống")
    private Long contractId;

    @NotNull(message = "Tháng lập hóa đơn không được để trống")
    private LocalDate billingMonth; // truyền lên dạng "2024-11-01"

    @NotNull(message = "Chỉ số điện đầu kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số điện phải >= 0")
    private Integer electricOld;

    @NotNull(message = "Chỉ số điện cuối kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số điện phải >= 0")
    private Integer electricNew;

    @NotNull(message = "Chỉ số nước đầu kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số nước phải >= 0")
    private Integer waterOld;

    @NotNull(message = "Chỉ số nước cuối kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số nước phải >= 0")
    private Integer waterNew;

    // Đơn giá điện (VNĐ/kWh) — nếu null dùng giá mặc định
    private BigDecimal electricUnitPrice;

    // Đơn giá nước (VNĐ/m³) — nếu null dùng giá mặc định
    private BigDecimal waterUnitPrice;

    @Min(value = 0, message = "Số người dịch vụ phải >= 0")
    private Integer servicePeople;

    // Đơn giá dịch vụ theo đầu người (VNĐ/người) — nếu null dùng mặc định 0
    @DecimalMin(value = "0", message = "Đơn giá dịch vụ phải >= 0")
    private BigDecimal serviceUnitPrice;

    // Đơn giá mạng (VNĐ/tháng) — nếu null dùng mặc định 0
    @DecimalMin(value = "0", message = "Đơn giá mạng phải >= 0")
    private BigDecimal networkUnitPrice;
}
