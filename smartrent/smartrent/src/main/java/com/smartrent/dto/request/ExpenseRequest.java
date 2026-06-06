package com.smartrent.dto.request;

import com.smartrent.entity.Expense;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ExpenseRequest {

    @NotNull(message = "Khu trọ không được để trống")
    private Long propertyId;

    @NotNull(message = "Danh mục không được để trống")
    private Expense.Category category;

    @NotNull(message = "Số tiền không được để trống")
    @DecimalMin(value = "1000", message = "Số tiền phải >= 1.000đ")
    private BigDecimal amount;

    @NotBlank(message = "Mô tả không được để trống")
    @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
    private String description;

    @NotNull(message = "Ngày phát sinh không được để trống")
    private LocalDate expenseDate;

    private String receiptImageUrl;
}
