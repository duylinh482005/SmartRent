package com.smartrent.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class PropertyResponse {
    private Long id;
    private String name;
    private String address;
    private String description;
    private Long ownerId;
    private String ownerUsername;
    private int totalRooms;
    private BigDecimal electricUnitPrice;
    private BigDecimal waterUnitPrice;
    private BigDecimal serviceUnitPrice;
    private BigDecimal networkFee;
    private LocalDateTime createdAt;
}