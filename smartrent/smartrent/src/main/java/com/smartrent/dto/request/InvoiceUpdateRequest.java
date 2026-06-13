package com.smartrent.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InvoiceUpdateRequest {

    @NotNull(message = "Chỉ số điện cuối kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số điện phải >= 0")
    private Integer electricNew;

    @NotNull(message = "Chỉ số nước cuối kỳ không được để trống")
    @Min(value = 0, message = "Chỉ số nước phải >= 0")
    private Integer waterNew;
}
