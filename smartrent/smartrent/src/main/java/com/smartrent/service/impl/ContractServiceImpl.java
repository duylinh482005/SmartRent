package com.smartrent.service.impl;

import com.smartrent.dto.request.ContractRequest;
import com.smartrent.dto.request.ContractUpdateRequest;
import com.smartrent.dto.response.ContractResponse;
import com.smartrent.entity.Contract;
import com.smartrent.entity.Invoice;
import com.smartrent.entity.Room;
import com.smartrent.entity.Tenant;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.repository.TenantRepository;
import com.smartrent.service.ContractService;
import com.smartrent.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.scheduling.annotation.Scheduled;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ContractServiceImpl implements ContractService {

    private static final String ERR_NOT_FOUND = "Không tìm thấy hợp đồng id: ";
    private static final String ERR_ACTIVE = "Không thể xóa: Hợp đồng đang có hiệu lực";
    private static final String ERR_CURRENT_PERIOD = "Không thể xóa: Hợp đồng đang trong kỳ thanh toán hiện tại";
    private static final String ERR_STATUS_RULE = "Không thể xóa: Chỉ cho phép xóa hợp đồng đã chấm dứt, hết hạn hoặc chưa đến ngày bắt đầu";

    private final ContractRepository contractRepository;
    private final RoomRepository roomRepository;
    private final TenantRepository tenantRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceService invoiceService;

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

        Room room = roomRepository.findByIdAndDeletedFalse(request.getRoomId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng id: " + request.getRoomId()));

        if (room.getStatus() != Room.Status.AVAILABLE) {
            throw new RuntimeException("Phòng '" + room.getRoomNumber() + "' hiện không còn trống");
        }

        contractRepository.findByRoomIdAndStatusAndDeletedFalse(request.getRoomId(), Contract.Status.ACTIVE)
                .ifPresent(c -> {
                    throw new RuntimeException("Phòng này đã có hợp đồng đang hiệu lực (id: " + c.getId() + ")");
                });

        Tenant tenant = tenantRepository.findByIdAndDeletedFalse(request.getTenantId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khách thuê id: " + request.getTenantId()));

        if (request.getNumberOfPeople() == null || request.getNumberOfPeople() < 1) {
            throw new RuntimeException("Số người thuê phải ít nhất là 1");
        }

        Contract contract = Contract.builder()
                .room(room)
                .tenant(tenant)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .monthlyRent(request.getMonthlyRent())
                .numberOfPeople(request.getNumberOfPeople())
                .status(Contract.Status.ACTIVE)
                .depositBalance(request.getMonthlyRent())
                .build();

        room.setStatus(Room.Status.OCCUPIED);
        roomRepository.save(room);

        Contract saved = contractRepository.save(contract);
        invoiceService.createFirstMonthInvoice(saved.getId());
        return toResponse(saved);
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

        BigDecimal outstandingDebt = invoiceRepository.sumOutstandingByContractId(id);
        if (outstandingDebt != null && outstandingDebt.compareTo(BigDecimal.ZERO) > 0) {
            throw new RuntimeException(
                    "Không thể chấm dứt: Khách thuê còn nợ " + formatCurrency(outstandingDebt)
                    + " chưa thanh toán. Hãy thu tiền hoặc xử lý hóa đơn trước.");
        }

        contract.setStatus(Contract.Status.TERMINATED);

        Room room = contract.getRoom();
        room.setStatus(Room.Status.AVAILABLE);
        roomRepository.save(room);

        return toResponse(contractRepository.save(contract));
    }

    @Override
    public ContractResponse update(Long id, ContractUpdateRequest request) {
        Contract contract = findById(id);

        if (contract.getStatus() == Contract.Status.TERMINATED) {
            throw new RuntimeException("Không thể sửa hợp đồng đã chấm dứt");
        }
        if (contract.getStatus() == Contract.Status.EXPIRED) {
            throw new RuntimeException("Không thể sửa hợp đồng đã hết hạn");
        }

        if (request.getEndDate() != null) {
            if (!request.getEndDate().isAfter(contract.getStartDate())) {
                throw new RuntimeException("Ngày kết thúc phải sau ngày bắt đầu hợp đồng (" + contract.getStartDate() + ")");
            }
            if (request.getEndDate().isBefore(contract.getStartDate().plusMonths(6))) {
                throw new RuntimeException("Thời hạn hợp đồng tối thiểu là 6 tháng");
            }
            contract.setEndDate(request.getEndDate());
        }
        if (request.getMonthlyRent() != null) {
            if (request.getMonthlyRent().compareTo(BigDecimal.ZERO) <= 0) {
                throw new RuntimeException("Tiền thuê phải lớn hơn 0");
            }
            contract.setMonthlyRent(request.getMonthlyRent());
        }
        if (request.getNumberOfPeople() != null) {
            if (request.getNumberOfPeople() < 1) {
                throw new RuntimeException("Số người phải ít nhất là 1");
            }
            contract.setNumberOfPeople(request.getNumberOfPeople());
        }

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

    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Ho_Chi_Minh")
    public void expireContractsDaily() {
        LocalDate today = LocalDate.now();
        List<Contract> expired = contractRepository.findActiveContractsExpiredBefore(today);

        if (expired.isEmpty()) return;

        List<Room> roomsToRelease = new ArrayList<>();
        for (Contract contract : expired) {
            contract.setStatus(Contract.Status.EXPIRED);
            Room room = contract.getRoom();
            if (room.getStatus() == Room.Status.OCCUPIED) {
                room.setStatus(Room.Status.AVAILABLE);
                roomsToRelease.add(room);
            }
            log.info("[CONTRACT_EXPIRED] contractId={} roomId={} endDate={}",
                    contract.getId(), room.getId(), contract.getEndDate());
        }

        roomRepository.saveAll(roomsToRelease);
        contractRepository.saveAll(expired);
        log.info("[CONTRACT_EXPIRED] totalExpired={} runAt={}", expired.size(), LocalDateTime.now());
    }

    private String getDeleteBlockedReason(Contract contract) {
        Long contractId = contract.getId();
        LocalDate today = LocalDate.now();

        boolean isTerminated = contract.getStatus() == Contract.Status.TERMINATED;
        boolean isExpired = contract.getStatus() == Contract.Status.EXPIRED;
        boolean isNotStartedYet = contract.getStartDate().isAfter(today);
        boolean isInEffect = contract.getStatus() == Contract.Status.ACTIVE && !isNotStartedYet;

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

        if ((isExpired || isTerminated) && invoiceRepository.existsByContractIdAndStatusAndDeletedFalse(contractId, Invoice.Status.PAID)) {
            return "Không thể xóa: Hợp đồng đã có lịch sử thu tiền, cần lưu trữ để đối soát tài chính";
        }

        if (!isTerminated && !isExpired && !isNotStartedYet) {
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
                .numberOfPeople(c.getNumberOfPeople())
                .status(c.getStatus())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
