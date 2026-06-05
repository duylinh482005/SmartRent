package com.smartrent.service.impl;

import com.smartrent.dto.request.InvoiceRequest;
import com.smartrent.dto.response.InvoiceResponse;
import com.smartrent.entity.Contract;
import com.smartrent.entity.Invoice;
import com.smartrent.entity.Property;
import com.smartrent.entity.Room;
import com.smartrent.entity.Tenant;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.repository.TenantRepository;
import com.smartrent.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class InvoiceServiceImpl implements InvoiceService {

    private static final String ERR_NOT_FOUND = "Không tìm thấy hóa đơn id: ";
    private static final String ERR_EDIT_PAID = "Không thể sửa: Hóa đơn đã thanh toán, liên hệ admin để điều chỉnh";
    private static final String ERR_DELETE_NOTIFIED = "Không thể xóa: Đã gửi thông báo cho khách thuê";
    private static final String ERR_DELETE_OVERDUE = "Không thể xóa: Hóa đơn đang ở trạng thái Quá hạn";
    private static final DateTimeFormatter DELETE_DATE_FMT = DateTimeFormatter.ofPattern("d/M/yyyy");

    private static final BigDecimal DAILY_LATE_FEE = new BigDecimal("100000");
    private static final int AUTO_TERMINATE_DAYS = 3;

    private final InvoiceRepository invoiceRepository;
    private final ContractRepository contractRepository;
    private final RoomRepository roomRepository;
    private final TenantRepository tenantRepository;

    @Override
    public InvoiceResponse create(InvoiceRequest request) {
        LocalDate billingMonth = request.getBillingMonth().withDayOfMonth(1);

        Contract contract = contractRepository.findByIdAndDeletedFalse(request.getContractId())
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy hợp đồng id: " + request.getContractId()));

        if (contract.getStatus() != Contract.Status.ACTIVE) {
            throw new RuntimeException("Hợp đồng không còn hiệu lực, không thể tạo hóa đơn");
        }

        LocalDate contractStart = contract.getStartDate().withDayOfMonth(1);
        LocalDate contractEnd = contract.getEndDate().withDayOfMonth(1);
        if (billingMonth.isBefore(contractStart)) {
            throw new RuntimeException("Kỳ thanh toán " + billingMonth.getMonth().getValue() + "/" + billingMonth.getYear()
                    + " trước ngày bắt đầu hợp đồng (" + contract.getStartDate() + ")");
        }
        if (billingMonth.isAfter(contractEnd)) {
            throw new RuntimeException("Kỳ thanh toán " + billingMonth.getMonth().getValue() + "/" + billingMonth.getYear()
                    + " sau ngày kết thúc hợp đồng (" + contract.getEndDate() + ")");
        }

        if (invoiceRepository.existsByContractIdAndBillingMonthAndDeletedFalse(
                request.getContractId(), billingMonth)) {
            throw new RuntimeException("Hóa đơn tháng "
                    + billingMonth.getMonth().getValue() + "/"
                    + billingMonth.getYear()
                    + " đã được tạo cho hợp đồng này");
        }

        // Lấy đơn giá từ khu trọ
        Property property = contract.getRoom().getProperty();
        BigDecimal electricPrice = property.getElectricUnitPrice();
        BigDecimal waterPrice = property.getWaterUnitPrice();
        BigDecimal servicePrice = property.getServiceUnitPrice();
        BigDecimal networkPrice = property.getNetworkFee();

        // Lấy chỉ số đầu kỳ từ hóa đơn tháng trước (nếu có)
        Invoice previousInvoice = invoiceRepository
                .findTopByContractIdAndBillingMonthLessThanAndDeletedFalseOrderByBillingMonthDesc(
                        request.getContractId(), billingMonth)
                .orElse(null);

        int electricOld = (previousInvoice != null && previousInvoice.getElectricNew() != null)
                ? previousInvoice.getElectricNew() : 0;
        int waterOld = (previousInvoice != null && previousInvoice.getWaterNew() != null)
                ? previousInvoice.getWaterNew() : 0;

        if (request.getElectricNew() < electricOld) {
            throw new RuntimeException(
                    "Chỉ số điện (" + request.getElectricNew() + ") nhỏ hơn chỉ số tháng trước (" + electricOld + ")");
        }
        if (request.getWaterNew() < waterOld) {
            throw new RuntimeException(
                    "Chỉ số nước (" + request.getWaterNew() + ") nhỏ hơn chỉ số tháng trước (" + waterOld + ")");
        }

        int servicePeople = contract.getNumberOfPeople() != null ? contract.getNumberOfPeople() : 0;
        int electricUsed = request.getElectricNew() - electricOld;
        int waterUsed = request.getWaterNew() - waterOld;

        BigDecimal roomFee = contract.getMonthlyRent();
        BigDecimal electricFee = electricPrice.multiply(BigDecimal.valueOf(electricUsed));
        BigDecimal waterFee = waterPrice.multiply(BigDecimal.valueOf(waterUsed));
        BigDecimal serviceFee = servicePrice.multiply(BigDecimal.valueOf(servicePeople));
        BigDecimal networkFee = networkPrice;
        BigDecimal totalAmount = roomFee
                .add(electricFee)
                .add(waterFee)
                .add(serviceFee)
                .add(networkFee);

        Invoice invoice = Invoice.builder()
                .contract(contract)
                .billingMonth(billingMonth)
                .depositFee(BigDecimal.ZERO)
                .roomFee(roomFee)
                .electricOld(electricOld)
                .electricNew(request.getElectricNew())
                .electricUnitPrice(electricPrice)
                .electricFee(electricFee)
                .waterOld(waterOld)
                .waterNew(request.getWaterNew())
                .waterUnitPrice(waterPrice)
                .waterFee(waterFee)
                .servicePeople(servicePeople)
                .serviceUnitPrice(servicePrice)
                .serviceFee(serviceFee)
                .networkUnitPrice(networkPrice)
                .networkFee(networkFee)
                .totalAmount(totalAmount)
                .status(Invoice.Status.UNPAID)
                .dueDate(LocalDate.now().plusDays(5))
                .build();

        return toResponse(invoiceRepository.save(invoice));
    }

    @Override
    public InvoiceResponse createFirstMonthInvoice(Long contractId) {
        Contract contract = contractRepository.findByIdAndDeletedFalse(contractId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy hợp đồng id: " + contractId));

        LocalDate startDate = contract.getStartDate();
        LocalDate billingMonth = startDate.withDayOfMonth(1);

        if (invoiceRepository.existsByContractIdAndBillingMonthAndDeletedFalse(contractId, billingMonth)) {
            throw new RuntimeException("Hóa đơn tháng đầu đã tồn tại cho hợp đồng này");
        }

        int daysInMonth = startDate.lengthOfMonth();
        int daysRemaining = daysInMonth - startDate.getDayOfMonth() + 1;
        BigDecimal ratio = BigDecimal.valueOf(daysRemaining)
                .divide(BigDecimal.valueOf(daysInMonth), 10, RoundingMode.HALF_UP);

        Property property = contract.getRoom().getProperty();
        BigDecimal servicePrice = property.getServiceUnitPrice();
        BigDecimal networkPrice = property.getNetworkFee();
        int numberOfPeople = contract.getNumberOfPeople() != null ? contract.getNumberOfPeople() : 0;

        BigDecimal depositFee = contract.getMonthlyRent();
        BigDecimal roomFee = contract.getMonthlyRent()
                .multiply(ratio).setScale(0, RoundingMode.HALF_UP);
        BigDecimal serviceFee = servicePrice
                .multiply(BigDecimal.valueOf(numberOfPeople))
                .multiply(ratio).setScale(0, RoundingMode.HALF_UP);
        BigDecimal networkFee = networkPrice
                .multiply(ratio).setScale(0, RoundingMode.HALF_UP);
        BigDecimal totalAmount = depositFee.add(roomFee).add(serviceFee).add(networkFee);

        Invoice invoice = Invoice.builder()
                .contract(contract)
                .billingMonth(billingMonth)
                .depositFee(depositFee)
                .roomFee(roomFee)
                .electricOld(0)
                .electricNew(0)
                .electricUnitPrice(property.getElectricUnitPrice())
                .electricFee(BigDecimal.ZERO)
                .waterOld(0)
                .waterNew(0)
                .waterUnitPrice(property.getWaterUnitPrice())
                .waterFee(BigDecimal.ZERO)
                .servicePeople(numberOfPeople)
                .serviceUnitPrice(servicePrice)
                .serviceFee(serviceFee)
                .networkUnitPrice(networkPrice)
                .networkFee(networkFee)
                .totalAmount(totalAmount)
                .status(Invoice.Status.UNPAID)
                .dueDate(LocalDate.now().plusDays(5))
                .build();

        return toResponse(invoiceRepository.save(invoice));
    }

    @Override
    @Transactional(readOnly = true)
    public InvoiceResponse getById(Long id) {
        return toResponse(findById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<InvoiceResponse> getAll() {
        return invoiceRepository.findByDeletedFalse().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InvoiceResponse> getByContract(Long contractId) {
        return invoiceRepository.findByContractIdAndDeletedFalse(contractId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InvoiceResponse> getByStatus(Invoice.Status status) {
        return invoiceRepository.findByStatusAndDeletedFalse(status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public InvoiceResponse markAsPaid(Long id) {
        Invoice invoice = findById(id);

        if (invoice.getStatus() == Invoice.Status.PAID) {
            throw new RuntimeException(ERR_EDIT_PAID);
        }

        if (invoice.getStatus() != Invoice.Status.UNPAID && invoice.getStatus() != Invoice.Status.OVERDUE) {
            throw new RuntimeException("Không thể thanh toán hóa đơn ở trạng thái hiện tại");
        }

        invoice.setStatus(Invoice.Status.PAID);
        invoice.setPaidAt(LocalDateTime.now());
        invoice.setPaymentConfirmedBy(getCurrentUsername());

        return toResponse(invoiceRepository.save(invoice));
    }

    @Override
    public void delete(Long id) {
        Invoice invoice = findById(id);

        if (invoice.getStatus() == Invoice.Status.PAID) {
            String paidDate = invoice.getPaidAt() != null
                    ? invoice.getPaidAt().toLocalDate().format(DELETE_DATE_FMT)
                    : "không xác định";
            throw new RuntimeException("Không thể xóa: Hóa đơn đã được thanh toán ngày " + paidDate);
        }

        if (invoice.isNotificationSent()) {
            throw new RuntimeException(ERR_DELETE_NOTIFIED);
        }

        if (invoice.getStatus() == Invoice.Status.OVERDUE) {
            throw new RuntimeException(ERR_DELETE_OVERDUE);
        }

        if (invoice.getStatus() != Invoice.Status.UNPAID) {
            throw new RuntimeException("Không thể xóa hóa đơn ở trạng thái hiện tại");
        }

        invoice.setDeleted(true);
        invoice.setDeletedAt(LocalDateTime.now());
        invoice.setDeletedBy(getCurrentUsername());
        invoiceRepository.save(invoice);
    }

    @Scheduled(cron = "0 10 0 * * *", zone = "Asia/Ho_Chi_Minh")
    public void updateOverdueInvoicesDaily() {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        // Bước 1: Chuyển UNPAID → OVERDUE nếu đã quá dueDate
        List<Invoice> unpaid = invoiceRepository.findByStatusAndDeletedFalse(Invoice.Status.UNPAID);
        List<Invoice> newlyOverdue = new ArrayList<>();
        for (Invoice invoice : unpaid) {
            if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(today)) {
                invoice.setStatus(Invoice.Status.OVERDUE);
                newlyOverdue.add(invoice);
                log.info("[OVERDUE_START] invoiceId={} dueDate={}", invoice.getId(), invoice.getDueDate());
            }
        }
        if (!newlyOverdue.isEmpty()) {
            invoiceRepository.saveAll(newlyOverdue);
        }

        // Bước 2: Tính tiền phạt cho tất cả hóa đơn OVERDUE, gom theo hợp đồng
        List<Invoice> overdueAll = invoiceRepository.findByStatusAndDeletedFalse(Invoice.Status.OVERDUE);
        if (overdueAll.isEmpty()) return;

        Map<Long, Contract> contractById = new HashMap<>();
        Map<Long, List<Invoice>> invoicesByContract = new HashMap<>();
        for (Invoice invoice : overdueAll) {
            Contract contract = invoice.getContract();
            Long contractId = contract.getId();
            contractById.put(contractId, contract);
            invoicesByContract.computeIfAbsent(contractId, k -> new ArrayList<>()).add(invoice);
        }

        List<Invoice> invoicesToSave = new ArrayList<>();
        List<Contract> contractsToSave = new ArrayList<>();
        List<Tenant> tenantsToSave = new ArrayList<>();
        List<Room> roomsToSave = new ArrayList<>();

        for (Map.Entry<Long, List<Invoice>> entry : invoicesByContract.entrySet()) {
            Long contractId = entry.getKey();
            List<Invoice> contractInvoices = entry.getValue();
            Contract contract = contractById.get(contractId);

            if (contract.getStatus() != Contract.Status.ACTIVE) continue;

            boolean shouldTerminate = false;
            int maxOverdueDays = 0;

            for (Invoice invoice : contractInvoices) {
                long newOverdueDays = ChronoUnit.DAYS.between(invoice.getDueDate(), today);
                long prevDays = invoice.getOverdueDays() != null ? invoice.getOverdueDays() : 0;
                long increment = newOverdueDays - prevDays;

                if (increment > 0) {
                    BigDecimal additionalFine = DAILY_LATE_FEE.multiply(BigDecimal.valueOf(increment));
                    BigDecimal currentLateFee = invoice.getLateFee() != null ? invoice.getLateFee() : BigDecimal.ZERO;
                    invoice.setLateFee(currentLateFee.add(additionalFine));
                    invoice.setOverdueDays((int) newOverdueDays);

                    BigDecimal newBalance = contract.getDepositBalance() != null
                            ? contract.getDepositBalance().subtract(additionalFine)
                            : BigDecimal.ZERO;
                    contract.setDepositBalance(newBalance.max(BigDecimal.ZERO));

                    log.info("[LATE_FEE] invoiceId={} overdueDays={} lateFee={} depositBalance={}",
                            invoice.getId(), newOverdueDays, invoice.getLateFee(), contract.getDepositBalance());
                }

                if (newOverdueDays >= AUTO_TERMINATE_DAYS) {
                    shouldTerminate = true;
                    if (newOverdueDays > maxOverdueDays) maxOverdueDays = (int) newOverdueDays;
                }

                invoicesToSave.add(invoice);
            }

            // Bước 3: Tự động chấm dứt hợp đồng sau 3 ngày quá hạn
            if (shouldTerminate) {
                contract.setDepositBalance(BigDecimal.ZERO);
                contract.setStatus(Contract.Status.TERMINATED);

                Room room = contract.getRoom();
                room.setStatus(Room.Status.AVAILABLE);
                roomsToSave.add(room);

                // Tiền cọc tự thanh toán toàn bộ hóa đơn quá hạn
                for (Invoice invoice : contractInvoices) {
                    invoice.setStatus(Invoice.Status.PAID);
                    invoice.setPaidAt(now);
                    invoice.setPaymentConfirmedBy("system:deposit-forfeited");
                    log.info("[AUTO_TERMINATE] invoiceId={} settledByDeposit contractId={}", invoice.getId(), contractId);
                }

                // Cập nhật lịch sử trễ hạn của khách thuê
                Tenant tenant = contract.getTenant();
                tenant.setLatePaymentCount(tenant.getLatePaymentCount() + 1);
                tenant.setTotalLateDays(tenant.getTotalLateDays() + maxOverdueDays);
                tenant.setLastLatePaymentDate(today);
                tenantsToSave.add(tenant);

                log.warn("[AUTO_TERMINATE] contractId={} tenantId={} overdueDays={} depositForfeited runAt={}",
                        contractId, tenant.getId(), maxOverdueDays, now);
            }

            contractsToSave.add(contract);
        }

        if (!invoicesToSave.isEmpty()) invoiceRepository.saveAll(invoicesToSave);
        if (!contractsToSave.isEmpty()) contractRepository.saveAll(contractsToSave);
        if (!roomsToSave.isEmpty()) roomRepository.saveAll(roomsToSave);
        if (!tenantsToSave.isEmpty()) tenantRepository.saveAll(tenantsToSave);

        log.info("[DAILY_SCHEDULER] invoicesProcessed={} contractsUpdated={} terminated={} runAt={}",
                invoicesToSave.size(), contractsToSave.size(), roomsToSave.size(), now);
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

    private Invoice findById(Long id) {
        return invoiceRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException(ERR_NOT_FOUND + id));
    }

    private InvoiceResponse toResponse(Invoice i) {
        Contract contract = i.getContract();
        int electricUsed = (i.getElectricNew() != null && i.getElectricOld() != null)
                ? i.getElectricNew() - i.getElectricOld() : 0;
        int waterUsed = (i.getWaterNew() != null && i.getWaterOld() != null)
                ? i.getWaterNew() - i.getWaterOld() : 0;

        return InvoiceResponse.builder()
                .id(i.getId())
                .contractId(contract.getId())
                .tenantName(contract.getTenant().getFullName())
                .roomNumber(contract.getRoom().getRoomNumber())
                .propertyName(contract.getRoom().getProperty().getName())
                .billingMonth(i.getBillingMonth())
                .depositFee(zeroIfNull(i.getDepositFee()))
                .roomFee(i.getRoomFee())
                .electricOld(i.getElectricOld())
                .electricNew(i.getElectricNew())
                .electricUsed(electricUsed)
                .electricUnitPrice(zeroIfNull(i.getElectricUnitPrice()))
                .electricFee(zeroIfNull(i.getElectricFee()))
                .waterOld(i.getWaterOld())
                .waterNew(i.getWaterNew())
                .waterUsed(waterUsed)
                .waterUnitPrice(zeroIfNull(i.getWaterUnitPrice()))
                .waterFee(zeroIfNull(i.getWaterFee()))
                .servicePeople(zeroIfNull(i.getServicePeople()))
                .serviceUnitPrice(zeroIfNull(i.getServiceUnitPrice()))
                .serviceFee(zeroIfNull(i.getServiceFee()))
                .networkUnitPrice(zeroIfNull(i.getNetworkUnitPrice()))
                .networkFee(zeroIfNull(i.getNetworkFee()))
                .totalAmount(zeroIfNull(i.getTotalAmount()))
                .lateFee(zeroIfNull(i.getLateFee()))
                .overdueDays(i.getOverdueDays() != null ? i.getOverdueDays() : 0)
                .totalWithLateFee(zeroIfNull(i.getTotalAmount()).add(zeroIfNull(i.getLateFee())))
                .status(i.getStatus())
                .dueDate(i.getDueDate())
                .paidAt(i.getPaidAt())
                .paymentConfirmedBy(i.getPaymentConfirmedBy())
                .notificationSent(i.isNotificationSent())
                .createdAt(i.getCreatedAt())
                .build();
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private int zeroIfNull(Integer value) {
        return value != null ? value : 0;
    }
}
