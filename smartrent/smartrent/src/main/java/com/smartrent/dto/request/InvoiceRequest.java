package com.smartrent.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class InvoiceRequest {

    @NotNull(message = "ID hợp đồng không được để trống")
    private Long contractId;

    @NotNull(message = "Tháng lập hóa đơn không được để trống")
    private LocalDate billingMonth;

    @NotNull(message = "Chỉ số điện cuối kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số điện phải >= 0")
    private Integer electricNew;

    @NotNull(message = "Chỉ số nước cuối kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số nước phải >= 0")
    private Integer waterNew;

    @Min(value = 0, message = "Số người dịch vụ phải >= 0")
    private Integer servicePeople;
}
