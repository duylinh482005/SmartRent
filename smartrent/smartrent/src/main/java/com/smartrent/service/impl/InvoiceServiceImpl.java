package com.smartrent.service.impl;

import com.smartrent.dto.request.InvoiceRequest;
import com.smartrent.dto.response.InvoiceResponse;
import com.smartrent.entity.Contract;
import com.smartrent.entity.Invoice;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class InvoiceServiceImpl implements InvoiceService {

    private static final BigDecimal DEFAULT_ELECTRIC_PRICE = new BigDecimal("3500");
    private static final BigDecimal DEFAULT_WATER_PRICE = new BigDecimal("15000");
    private static final BigDecimal DEFAULT_SERVICE_PRICE = BigDecimal.ZERO;
    private static final BigDecimal DEFAULT_NETWORK_PRICE = BigDecimal.ZERO;

    private static final String ERR_NOT_FOUND = "Không tìm thấy hóa đơn id: ";
    private static final String ERR_EDIT_PAID = "Không thể sửa: Hóa đơn đã thanh toán, liên hệ admin để điều chỉnh";
    private static final String ERR_DELETE_NOTIFIED = "Không thể xóa: Đã gửi thông báo cho khách thuê";
    private static final String ERR_DELETE_OVERDUE = "Không thể xóa: Hóa đơn đang ở trạng thái Quá hạn";
    private static final DateTimeFormatter DELETE_DATE_FMT = DateTimeFormatter.ofPattern("d/M/yyyy");

    private final InvoiceRepository invoiceRepository;
    private final ContractRepository contractRepository;

    @Override
    public InvoiceResponse create(InvoiceRequest request) {
        Contract contract = contractRepository.findByIdAndDeletedFalse(request.getContractId())
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy hợp đồng id: " + request.getContractId()));

        if (contract.getStatus() != Contract.Status.ACTIVE) {
            throw new RuntimeException("Hợp đồng không còn hiệu lực, không thể tạo hóa đơn");
        }

        if (invoiceRepository.existsByContractIdAndBillingMonthAndDeletedFalse(
                request.getContractId(), request.getBillingMonth())) {
            throw new RuntimeException("Hóa đơn tháng "
                    + request.getBillingMonth().getMonth().getValue() + "/"
                    + request.getBillingMonth().getYear()
                    + " đã được tạo cho hợp đồng này");
        }

        if (request.getElectricNew() < request.getElectricOld()) {
            throw new RuntimeException("Chỉ số điện cuối kỳ phải >= đầu kỳ");
        }
        if (request.getWaterNew() < request.getWaterOld()) {
            throw new RuntimeException("Chỉ số nước cuối kỳ phải >= đầu kỳ");
        }

        BigDecimal electricPrice = request.getElectricUnitPrice() != null
                ? request.getElectricUnitPrice() : DEFAULT_ELECTRIC_PRICE;
        BigDecimal waterPrice = request.getWaterUnitPrice() != null
                ? request.getWaterUnitPrice() : DEFAULT_WATER_PRICE;
        int servicePeople = request.getServicePeople() != null
                ? request.getServicePeople() : 0;
        BigDecimal servicePrice = request.getServiceUnitPrice() != null
                ? request.getServiceUnitPrice() : DEFAULT_SERVICE_PRICE;
        BigDecimal networkPrice = request.getNetworkUnitPrice() != null
                ? request.getNetworkUnitPrice() : DEFAULT_NETWORK_PRICE;

        int electricUsed = request.getElectricNew() - request.getElectricOld();
        int waterUsed = request.getWaterNew() - request.getWaterOld();

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
                .billingMonth(request.getBillingMonth())
                .roomFee(roomFee)
                .electricOld(request.getElectricOld())
                .electricNew(request.getElectricNew())
                .electricUnitPrice(electricPrice)
                .electricFee(electricFee)
                .waterOld(request.getWaterOld())
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
                .dueDate(resolveDefaultDueDateForMonth(request.getBillingMonth()))
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
        List<Invoice> unpaidInvoices = invoiceRepository.findByStatusAndDeletedFalse(Invoice.Status.UNPAID);

        if (unpaidInvoices.isEmpty()) {
            return;
        }

        LocalDateTime transitionedAt = LocalDateTime.now();
        List<Invoice> overdueInvoices = new ArrayList<>();

        for (Invoice invoice : unpaidInvoices) {
            LocalDate dueDate = resolveDueDate(invoice);
            if (dueDate != null && dueDate.isBefore(today)) {
                invoice.setStatus(Invoice.Status.OVERDUE);
                overdueInvoices.add(invoice);
                log.info("[INVOICE_OVERDUE] invoiceId={} transitionedAt={} dueDate={}",
                        invoice.getId(), transitionedAt, dueDate);
            }
        }

        if (!overdueInvoices.isEmpty()) {
            invoiceRepository.saveAll(overdueInvoices);
            log.info("[INVOICE_OVERDUE] totalUpdated={} runAt={}", overdueInvoices.size(), transitionedAt);
        }
    }

    private LocalDate resolveDefaultDueDateForMonth(LocalDate billingMonth) {
        if (billingMonth == null) {
            return null;
        }
        return YearMonth.from(billingMonth).atEndOfMonth();
    }

    private LocalDate resolveDueDate(Invoice invoice) {
        if (invoice.getDueDate() != null) {
            return invoice.getDueDate();
        }
        return resolveDefaultDueDateForMonth(invoice.getBillingMonth());
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
