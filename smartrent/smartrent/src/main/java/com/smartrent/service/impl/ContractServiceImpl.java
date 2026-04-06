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

    private static final String ERR_NOT_FOUND = "Không tìm thấy hợp đồng id: ";
    private static final String ERR_ACTIVE = "Không thể xóa: Hợp đồng đang có hiệu lực";
    private static final String ERR_CURRENT_PERIOD = "Không thể xóa: Hợp đồng đang trong kỳ thanh toán hiện tại";
    private static final String ERR_PAYMENT_HISTORY = "Không thể xóa: Hợp đồng đã phát sinh lịch sử thanh toán";
    private static final String ERR_STATUS_RULE = "Không thể xóa: Chỉ cho phép xóa hợp đồng đã chấm dứt hoặc chưa đến ngày bắt đầu";

    private final ContractRepository contractRepository;
    private final RoomRepository roomRepository;
    private final TenantRepository tenantRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;

    @Override
    public ContractResponse create(ContractRequest request) {
        LocalDate today = LocalDate.now();

        if (request.getStartDate().isBefore(today)) {
            throw new RuntimeException("Ngày bắt đầu hợp đồng không được ở trong quá khứ");
        }

        if (!request.getEndDate().isAfter(request.getStartDate())) {
            throw new RuntimeException("Ngày kết thúc phải sau ngày bắt đầu");
        }

        if (request.getEndDate().isBefore(request.getStartDate().plusMonths(6))) {
            throw new RuntimeException("Thời hạn hợp đồng tối thiểu là 6 tháng");
        }

        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng id: " + request.getRoomId()));

        if (room.getStatus() != Room.Status.AVAILABLE) {
            throw new RuntimeException("Phòng '" + room.getRoomNumber() + "' hiện không còn trống");
        }

        contractRepository.findByRoomIdAndStatusAndDeletedFalse(request.getRoomId(), Contract.Status.ACTIVE)
                .ifPresent(c -> {
                    throw new RuntimeException("Phòng này đã có hợp đồng đang hiệu lực (id: " + c.getId() + ")");
                });

        Tenant tenant = tenantRepository.findById(request.getTenantId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khách thuê id: " + request.getTenantId()));

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
            throw new RuntimeException("Hợp đồng không ở trạng thái ACTIVE, không thể chấm dứt");
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
            return "Không thể xóa: Khách thuê còn nợ "
                    + formatCurrency(outstandingDebt)
                    + " chưa thanh toán";
        }

        long paymentCount = paymentRepository.countByInvoiceContractId(contractId);
        if (paymentCount > 0) {
            return ERR_PAYMENT_HISTORY;
        }

        long invoiceCount = invoiceRepository.countByContractId(contractId);
        if (invoiceCount > 0) {
            return "Không thể xóa: Hợp đồng đã phát sinh " + invoiceCount + " hóa đơn thanh toán";
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
        return formatter.format(normalized) + "đ";
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
