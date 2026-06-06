package com.smartrent.dto.response;

import com.smartrent.entity.Expense;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class ExpenseResponse {
    private Long id;
    private Long propertyId;
    private String propertyName;
    private Expense.Category category;
    private BigDecimal amount;
    private String description;
    private LocalDate expenseDate;
    private String receiptImageUrl;
    private LocalDateTime createdAt;
}
