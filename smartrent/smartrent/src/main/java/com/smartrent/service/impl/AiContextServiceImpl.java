package com.smartrent.service.impl;

import com.smartrent.entity.Contract;
import com.smartrent.entity.Invoice;
import com.smartrent.entity.Room;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.service.AiContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiContextServiceImpl implements AiContextService {

    private final InvoiceRepository invoiceRepository;
    private final RoomRepository roomRepository;
    private final ContractRepository contractRepository;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Override
    public String buildContext() {
        StringBuilder ctx = new StringBuilder();
        ctx.append("=== DỮ LIỆU HỆ THỐNG QUẢN LÝ PHÒNG TRỌ ===\n\n");

        // 1. Hóa đơn chưa thanh toán
        List<Invoice> unpaid = invoiceRepository.findAllByStatusWithDetails(Invoice.Status.UNPAID);
        ctx.append("--- HÓA ĐƠN CHƯA THANH TOÁN (").append(unpaid.size()).append(" hóa đơn) ---\n");
        if (unpaid.isEmpty()) {
            ctx.append("Không có hóa đơn nào chưa thanh toán.\n");
        } else {
            for (Invoice i : unpaid) {
                ctx.append(String.format(
                        "• Hóa đơn #%d | Phòng: %s | Khu trọ: %s | Khách: %s | Tháng: %s | Tổng: %,.0f đ\n",
                        i.getId(),
                        i.getContract().getRoom().getRoomNumber(),
                        i.getContract().getRoom().getProperty().getName(),
                        i.getContract().getTenant().getFullName(),
                        i.getBillingMonth().format(DateTimeFormatter.ofPattern("MM/yyyy")),
                        i.getTotalAmount()
                ));
            }
        }
        ctx.append("\n");

        // 2. Phòng còn trống
        List<Room> available = roomRepository.findAll().stream()
                .filter(r -> r.getStatus() == Room.Status.AVAILABLE)
                .toList();
        ctx.append("--- PHÒNG CÒN TRỐNG (").append(available.size()).append(" phòng) ---\n");
        if (available.isEmpty()) {
            ctx.append("Không có phòng trống.\n");
        } else {
            for (Room r : available) {
                ctx.append(String.format(
                        "• Phòng %s | Khu trọ: %s | Giá: %,.0f đ/tháng | Diện tích: %d m²\n",
                        r.getRoomNumber(),
                        r.getProperty().getName(),
                        r.getPrice(),
                        r.getArea()
                ));
            }
        }
        ctx.append("\n");

        // 3. Hợp đồng sắp hết hạn (trong 30 ngày)
        LocalDate today = LocalDate.now();
        LocalDate in30days = today.plusDays(30);
        List<Contract> expiringSoon = contractRepository.findByDeletedFalse().stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE
                        && !c.getEndDate().isBefore(today)
                        && !c.getEndDate().isAfter(in30days))
                .toList();
        ctx.append("--- HỢP ĐỒNG SẮP HẾT HẠN TRONG 30 NGÀY (")
                .append(expiringSoon.size()).append(" hợp đồng) ---\n");
        if (expiringSoon.isEmpty()) {
            ctx.append("Không có hợp đồng nào sắp hết hạn.\n");
        } else {
            for (Contract c : expiringSoon) {
                ctx.append(String.format(
                        "• Hợp đồng #%d | Phòng: %s | Khách: %s | Hết hạn: %s | Còn: %d ngày\n",
                        c.getId(),
                        c.getRoom().getRoomNumber(),
                        c.getTenant().getFullName(),
                        c.getEndDate().format(FMT),
                        today.until(c.getEndDate()).getDays()
                ));
            }
        }
        ctx.append("\n");

        // 4. Thống kê tổng quan
        long totalRooms     = roomRepository.count();
        long occupiedRooms  = roomRepository.findAll().stream()
                .filter(r -> r.getStatus() == Room.Status.OCCUPIED).count();
        long activeContracts = contractRepository.findByDeletedFalse().stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE).count();

        ctx.append("--- THỐNG KÊ TỔNG QUAN ---\n");
        ctx.append("• Tổng số phòng: ").append(totalRooms).append("\n");
        ctx.append("• Đang cho thuê: ").append(occupiedRooms).append("\n");
        ctx.append("• Còn trống: ").append(available.size()).append("\n");
        ctx.append("• Hợp đồng đang hiệu lực: ").append(activeContracts).append("\n");
        ctx.append("• Hóa đơn chưa thu: ").append(unpaid.size()).append("\n");

        // 5. Tổng tiền chưa thu
        java.math.BigDecimal totalUnpaid = unpaid.stream()
                .map(Invoice::getTotalAmount)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        ctx.append(String.format("• Tổng tiền chưa thu: %,.0f đ\n", totalUnpaid));

        return ctx.toString();
    }
}