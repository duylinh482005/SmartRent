package com.smartrent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "invoices")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Invoice extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    private Contract contract;

    @Column(name = "billing_month", nullable = false)
    private LocalDate billingMonth;

    // Tiền cọc (chỉ có ở hóa đơn tháng đầu, bằng 1 tháng tiền phòng)
    @Column(name = "deposit_fee", precision = 12, scale = 2)
    private BigDecimal depositFee;

    // Tiền phòng
    @Column(name = "room_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal roomFee;

    // Điện
    @Column(name = "electric_old")
    private Integer electricOld;

    @Column(name = "electric_new")
    private Integer electricNew;

    @Column(name = "electric_unit_price", precision = 10, scale = 2)
    private BigDecimal electricUnitPrice;

    @Column(name = "electric_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal electricFee;

    // Nước
    @Column(name = "water_old")
    private Integer waterOld;

    @Column(name = "water_new")
    private Integer waterNew;

    @Column(name = "water_unit_price", precision = 10, scale = 2)
    private BigDecimal waterUnitPrice;

    @Column(name = "water_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal waterFee;

    // Dịch vụ chung (thang máy, máy giặt, dọn rác...)
    @Column(name = "service_people")
    private Integer servicePeople;

    @Column(name = "service_unit_price", precision = 10, scale = 2)
    private BigDecimal serviceUnitPrice;

    @Column(name = "service_fee", precision = 12, scale = 2)
    private BigDecimal serviceFee;

    // Mạng
    @Column(name = "network_unit_price", precision = 10, scale = 2)
    private BigDecimal networkUnitPrice;

    @Column(name = "network_fee", precision = 12, scale = 2)
    private BigDecimal networkFee;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.UNPAID;

    @Column(name = "payment_due_date")
    private LocalDate dueDate;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "payment_confirmed_by", length = 100)
    private String paymentConfirmedBy;

    // Tiền phạt quá hạn (100.000đ/ngày)
    @Column(name = "late_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal lateFee = BigDecimal.ZERO;

    // Số ngày quá hạn hiện tại
    @Column(name = "overdue_days")
    @Builder.Default
    private Integer overdueDays = 0;

    @Column(name = "notification_sent", nullable = false)
    @Builder.Default
    private boolean notificationSent = false;

    @Column(name = "notification_sent_at")
    private LocalDateTime notificationSentAt;

    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private boolean deleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_by", length = 100)
    private String deletedBy;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Payment> payments = new ArrayList<>();

    public enum Status {
        UNPAID, PAID, OVERDUE
    }
}
