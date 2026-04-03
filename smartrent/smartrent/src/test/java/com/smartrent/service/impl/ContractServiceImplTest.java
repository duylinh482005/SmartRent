package com.smartrent.service.impl;

import com.smartrent.dto.request.ContractRequest;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.PaymentRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.repository.TenantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@ExtendWith(MockitoExtension.class)
class ContractServiceImplTest {

    @Mock
    private ContractRepository contractRepository;

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @InjectMocks
    private ContractServiceImpl contractService;

    @Test
    void createShouldRejectPastStartDate() {
        ContractRequest request = buildRequest(LocalDate.now().minusDays(1), LocalDate.now().plusMonths(6));

        RuntimeException exception = assertThrows(RuntimeException.class, () -> contractService.create(request));

        assertEquals("Ngay bat dau hop dong khong duoc o trong qua khu", exception.getMessage());
    }

    @Test
    void createShouldRejectContractShorterThanSixMonths() {
        LocalDate startDate = LocalDate.now();
        ContractRequest request = buildRequest(startDate, startDate.plusMonths(6).minusDays(1));

        RuntimeException exception = assertThrows(RuntimeException.class, () -> contractService.create(request));

        assertEquals("Thoi han hop dong toi thieu la 6 thang", exception.getMessage());
    }

    private ContractRequest buildRequest(LocalDate startDate, LocalDate endDate) {
        ContractRequest request = new ContractRequest();
        request.setRoomId(1L);
        request.setTenantId(1L);
        request.setStartDate(startDate);
        request.setEndDate(endDate);
        request.setMonthlyRent(BigDecimal.valueOf(3_000_000));
        return request;
    }
}
