package com.smartrent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "expenses", indexes = {
    @Index(name = "idx_expense_date",     columnList = "expense_date"),
    @Index(name = "idx_expense_property", columnList = "property_id"),
    @Index(name = "idx_expense_deleted",  columnList = "is_deleted")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Expense extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Category category;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Column(name = "receipt_image_url", length = 500)
    private String receiptImageUrl;

    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private boolean deleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_by", length = 100)
    private String deletedBy;

    public enum Category {
        MAINTENANCE,
        UTILITY,
        SERVICE,
        TAX,
        INSURANCE,
        RENOVATION,
        OTHER
    }
}
