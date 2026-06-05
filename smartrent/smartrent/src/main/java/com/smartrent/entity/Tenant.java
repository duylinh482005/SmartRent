package com.smartrent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tenants")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Tenant extends BaseEntity {

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, length = 15, unique = true)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(name = "id_card_number", length = 20, unique = true)
    private String idCardNumber;

    // Thống kê trễ hạn - dùng cho AI phân tích/cảnh báo khách hay chậm trễ
    @Column(name = "late_payment_count", nullable = false)
    @Builder.Default
    private int latePaymentCount = 0;

    @Column(name = "total_late_days", nullable = false)
    @Builder.Default
    private int totalLateDays = 0;

    @Column(name = "last_late_payment_date")
    private LocalDate lastLatePaymentDate;

    @OneToMany(mappedBy = "tenant", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Contract> contracts = new ArrayList<>();

    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private boolean deleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_by", length = 100)
    private String deletedBy;
}