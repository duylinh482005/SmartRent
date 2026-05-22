package com.smartrent.dto.response;

import com.smartrent.entity.Contract;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class ContractResponse {
    private Long id;
    private Long propertyId;
    private String propertyName;
    private Long roomId;
    private String roomNumber;
    private Long tenantId;
    private String tenantName;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal monthlyRent;
    private Integer numberOfPeople;
    private Contract.Status status;
    private LocalDateTime createdAt;
}
