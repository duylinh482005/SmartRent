package com.smartrent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "properties")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Property extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 255)
    private String address;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "electric_unit_price", columnDefinition = "DECIMAL(10,2) NOT NULL DEFAULT 3500")
    @Builder.Default
    private BigDecimal electricUnitPrice = new BigDecimal("3500");

    @Column(name = "water_unit_price", columnDefinition = "DECIMAL(10,2) NOT NULL DEFAULT 15000")
    @Builder.Default
    private BigDecimal waterUnitPrice = new BigDecimal("15000");

    @Column(name = "service_unit_price", columnDefinition = "DECIMAL(10,2) NOT NULL DEFAULT 0")
    @Builder.Default
    private BigDecimal serviceUnitPrice = BigDecimal.ZERO;

    @Column(name = "network_fee", columnDefinition = "DECIMAL(10,2) NOT NULL DEFAULT 0")
    @Builder.Default
    private BigDecimal networkFee = BigDecimal.ZERO;

    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Room> rooms = new ArrayList<>();
}