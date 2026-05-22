package com.smartrent.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ContractRequest {

    @NotNull(message = "ID phòng không được để trống")
    private Long roomId;

    @NotNull(message = "ID khách thuê không được để trống")
    private Long tenantId;

    @NotNull(message = "Ngày bắt đầu không được để trống")
    private LocalDate startDate;

    @NotNull(message = "Ngày kết thúc không được để trống")
    private LocalDate endDate;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false, message = "Tiền thuê phải lớn hơn 0")
    private BigDecimal monthlyRent;

    @Min(value = 1, message = "Số người trong phòng phải ít nhất là 1")
    private Integer numberOfPeople;
}