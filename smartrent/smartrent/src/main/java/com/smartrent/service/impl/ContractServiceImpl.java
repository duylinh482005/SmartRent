package com.smartrent.service.impl;

import com.smartrent.dto.request.ContractRequest;
import com.smartrent.dto.response.ContractResponse;
import com.smartrent.entity.Contract;
import com.smartrent.entity.Room;
import com.smartrent.entity.Tenant;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.PaymentRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.repository.TenantRepository;
import com.smartrent.service.ContractService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ContractServiceImpl implements ContractService {

    private static final String ERR_NOT_FOUND = "Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ee3p \u0111\u1ed3ng id: ";
    private static final String ERR_ACTIVE = "Kh\u00f4ng th\u1ec3 x\u00f3a: H\u1ee3p \u0111\u1ed3ng \u0111ang c\u00f3 hi\u1ec7u l\u1ef1c";
    private static final String ERR_CURRENT_PERIOD = "Kh\u00f4ng th\u1ec3 x\u00f3a: H\u1ee3p \u0111\u1ed3ng \u0111ang trong k\u1ef3 thanh to\u00e1n hi\u1ec7n t\u1ea1i";
    private static final String ERR_PAYMENT_HISTORY = "Kh\u00f4ng th\u1ec3 x\u00f3a: H\u1ee3p \u0111\u1ed3ng \u0111\u00e3 ph\u00e1t sinh l\u1ecbch s\u1eed thanh to\u00e1n";
    private static final String ERR_STATUS_RULE = "Kh\u00f4ng th\u1ec3 x\u00f3a: Ch\u1ec9 cho ph\u00e9p x\u00f3a h\u1ee3p \u0111\u1ed3ng \u0111\u00e3 ch\u1ea5m d\u1ee9t ho\u1eb7c ch\u01b0a \u0111\u1ebfn ng\u00e0y b\u1eaft \u0111\u1ea7u";

    private final ContractRepository contractRepository;
    private final RoomRepository roomRepository;
    private final TenantRepository tenantRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;

    @Override
    public ContractResponse create(ContractRequest request) {
        LocalDate today = LocalDate.now();

        if (request.getStartDate().isBefore(today)) {
            throw new RuntimeException("Ngay bat dau hop dong khong duoc o trong qua khu");
        }

        if (!request.getEndDate().isAfter(request.getStartDate())) {
            throw new RuntimeException("Ng\u00e0y k\u1ebft th\u00fac ph\u1ea3i sau ng\u00e0y b\u1eaft \u0111\u1ea7u");
        }

        if (request.getEndDate().isBefore(request.getStartDate().plusMonths(6))) {
            throw new RuntimeException("Thoi han hop dong toi thieu la 6 thang");
        }

        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new RuntimeException("Kh\u00f4ng t\u00ecm th\u1ea5y ph\u00f2ng id: " + request.getRoomId()));

        if (room.getStatus() != Room.Status.AVAILABLE) {
            throw new RuntimeException("Ph\u00f2ng '" + room.getRoomNumber() + "' hi\u1ec7n kh\u00f4ng c\u00f2n tr\u1ed1ng");
        }

        contractRepository.findByRoomIdAndStatusAndDeletedFalse(request.getRoomId(), Contract.Status.ACTIVE)
                .ifPresent(c -> {
                    throw new RuntimeException("Ph\u00f2ng n\u00e0y \u0111\u00e3 c\u00f3 h\u1ee3p \u0111\u1ed3ng \u0111ang hi\u1ec7u l\u1ef1c (id: " + c.getId() + ")");
                });

        Tenant tenant = tenantRepository.findById(request.getTenantId())
                .orElseThrow(() -> new RuntimeException("Kh\u00f4ng t\u00ecm th\u1ea5y kh\u00e1ch thu\u00ea id: " + request.getTenantId()));

        Contract contract = Contract.builder()
                .room(room)
                .tenant(tenant)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .monthlyRent(request.getMonthlyRent())
                .status(Contract.Status.ACTIVE)
                .build();

        room.setStatus(Room.Status.OCCUPIED);
        roomRepository.save(room);

        return toResponse(contractRepository.save(contract));
    }

    @Override
    @Transactional(readOnly = true)
    public ContractResponse getById(Long id) {
        return toResponse(findById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContractResponse> getAll() {
        return contractRepository.findByDeletedFalse().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContractResponse> getByRoom(Long roomId) {
        return contractRepository.findByRoomIdAndDeletedFalse(roomId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContractResponse> getByTenant(Long tenantId) {
        return contractRepository.findByTenantIdAndDeletedFalse(tenantId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public ContractResponse terminate(Long id) {
        Contract contract = findById(id);

        if (contract.getStatus() != Contract.Status.ACTIVE) {
            throw new RuntimeException("H\u1ee3p \u0111\u1ed3ng kh\u00f4ng \u1edf tr\u1ea1ng th\u00e1i ACTIVE, kh\u00f4ng th\u1ec3 ch\u1ea5m d\u1ee9t");
        }

        contract.setStatus(Contract.Status.TERMINATED);

        Room room = contract.getRoom();
        room.setStatus(Room.Status.AVAILABLE);
        roomRepository.save(room);

        return toResponse(contractRepository.save(contract));
    }

    @Override
    public void delete(Long id) {
        Contract contract = findById(id);
        log.info("Received request to delete contract id={}", id);

        String blockedReason = getDeleteBlockedReason(contract);
        if (blockedReason != null) {
            log.warn("Blocked deleting contract id={} reason={}", id, blockedReason);
            throw new RuntimeException(blockedReason);
        }

        String deletedBy = getCurrentUsername();
        contract.setDeleted(true);
        contract.setDeletedAt(LocalDateTime.now());
        contract.setDeletedBy(deletedBy);

        Room room = contract.getRoom();
        if (room.getStatus() == Room.Status.OCCUPIED) {
            room.setStatus(Room.Status.AVAILABLE);
            roomRepository.save(room);
        }

        contractRepository.save(contract);

        log.info("Soft deleted contract id={} by={} deletedAt={}",
                contract.getId(),
                deletedBy,
                contract.getDeletedAt());
    }

    private String getDeleteBlockedReason(Contract contract) {
        Long contractId = contract.getId();
        LocalDate today = LocalDate.now();

        boolean isTerminated = contract.getStatus() == Contract.Status.TERMINATED;
        boolean isNotStartedYet = contract.getStartDate().isAfter(today);
        boolean isInEffect = contract.getStatus() == Contract.Status.ACTIVE
                && !isNotStartedYet
                && !contract.getEndDate().isBefore(today);

        if (isInEffect) {
            return ERR_ACTIVE;
        }

        LocalDate currentBillingMonth = YearMonth.now().atDay(1);
        if (invoiceRepository.existsByContractIdAndBillingMonthAndDeletedFalse(contractId, currentBillingMonth)) {
            return ERR_CURRENT_PERIOD;
        }

        BigDecimal outstandingDebt = invoiceRepository.sumOutstandingByContractId(contractId);
        if (outstandingDebt != null && outstandingDebt.compareTo(BigDecimal.ZERO) > 0) {
            return "Kh\u00f4ng th\u1ec3 x\u00f3a: Kh\u00e1ch thu\u00ea c\u00f2n n\u1ee3 "
                    + formatCurrency(outstandingDebt)
                    + " ch\u01b0a thanh to\u00e1n";
        }

        long paymentCount = paymentRepository.countByInvoiceContractId(contractId);
        if (paymentCount > 0) {
            return ERR_PAYMENT_HISTORY;
        }

        long invoiceCount = invoiceRepository.countByContractId(contractId);
        if (invoiceCount > 0) {
            return "Kh\u00f4ng th\u1ec3 x\u00f3a: H\u1ee3p \u0111\u1ed3ng \u0111\u00e3 ph\u00e1t sinh " + invoiceCount + " h\u00f3a \u0111\u01a1n thanh to\u00e1n";
        }

        if (!isTerminated && !isNotStartedYet) {
            return ERR_STATUS_RULE;
        }

        return null;
    }

    private String formatCurrency(BigDecimal amount) {
        BigDecimal normalized = amount.setScale(0, RoundingMode.HALF_UP);

        DecimalFormatSymbols symbols = new DecimalFormatSymbols();
        symbols.setGroupingSeparator('.');

        DecimalFormat formatter = new DecimalFormat("#,###", symbols);
        return formatter.format(normalized) + "\u0111";
    }

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return "system";
        }

        String username = authentication.getName();
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) {
            return "system";
        }

        return username;
    }

    private Contract findById(Long id) {
        return contractRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException(ERR_NOT_FOUND + id));
    }

    private ContractResponse toResponse(Contract c) {
        return ContractResponse.builder()
                .id(c.getId())
                .propertyId(c.getRoom().getProperty().getId())
                .propertyName(c.getRoom().getProperty().getName())
                .roomId(c.getRoom().getId())
                .roomNumber(c.getRoom().getRoomNumber())
                .tenantId(c.getTenant().getId())
                .tenantName(c.getTenant().getFullName())
                .startDate(c.getStartDate())
                .endDate(c.getEndDate())
                .monthlyRent(c.getMonthlyRent())
                .status(c.getStatus())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
