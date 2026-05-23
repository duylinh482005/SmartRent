package com.smartrent.service.impl;

import com.smartrent.entity.Contract;
import com.smartrent.entity.Invoice;
import com.smartrent.entity.Property;
import com.smartrent.entity.Room;
import com.smartrent.entity.Tenant;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.PropertyRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.repository.TenantRepository;
import com.smartrent.service.AiContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiContextServiceImpl implements AiContextService {

    private final InvoiceRepository  invoiceRepository;
    private final RoomRepository     roomRepository;
    private final ContractRepository contractRepository;
    private final TenantRepository   tenantRepository;
    private final PropertyRepository propertyRepository;

    private static final DateTimeFormatter DATE_FMT  = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MM/yyyy");

    private static final long CACHE_TTL_MS = 120_000; // 2 phút
    private volatile String cachedContext = null;
    private volatile long   cachedAt      = 0;

    @Override
    public String buildContext() {
        long now = System.currentTimeMillis();
        if (cachedContext != null && (now - cachedAt) < CACHE_TTL_MS) {
            return cachedContext;
        }
        LocalDate today = LocalDate.now();

        // Load core data (efficient with JOIN FETCH to avoid N+1)
        List<Room>     allRooms      = roomRepository.findAllWithProperty();
        List<Property> allProperties = propertyRepository.findAll();
        List<Tenant>   allTenants    = tenantRepository.findAll();
        List<Contract> allContracts  = contractRepository.findAllNonDeletedWithDetails();
        List<Invoice>  unpaid        = invoiceRepository.findAllByStatusWithDetails(Invoice.Status.UNPAID);
        List<Invoice>  overdue       = invoiceRepository.findAllByStatusWithDetails(Invoice.Status.OVERDUE);

        // Historical invoices for trend analysis (13 months window)
        LocalDate historyFrom = YearMonth.now().minusMonths(12).atDay(1);
        List<Invoice> allInvoices = invoiceRepository.findAllNonDeletedSinceWithDetails(historyFrom);

        // Lookup maps
        Map<Long, List<Room>> roomsByPropertyId = allRooms.stream()
                .collect(Collectors.groupingBy(r -> r.getProperty().getId()));

        Map<Long, Contract> activeByRoomId = allContracts.stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE)
                .collect(Collectors.toMap(c -> c.getRoom().getId(), c -> c, (a, b) -> a));

        Map<Long, Contract> activeByTenantId = allContracts.stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE)
                .collect(Collectors.toMap(c -> c.getTenant().getId(), c -> c, (a, b) -> a));

        StringBuilder ctx = new StringBuilder();
        ctx.append("=== DỮ LIỆU HỆ THỐNG QUẢN LÝ PHÒNG TRỌ ===\n");
        ctx.append("Ngày hôm nay: ").append(today.format(DATE_FMT)).append("\n\n");

        appendPropertySection(ctx, allProperties, roomsByPropertyId);
        appendRoomSection(ctx, allRooms, activeByRoomId);
        appendTenantSection(ctx, allTenants, activeByTenantId);
        appendContractSection(ctx, allContracts, today);
        appendInvoiceSection(ctx, unpaid, overdue, today);

        // Analytics sections
        appendRevenueHistorySection(ctx, allInvoices);
        appendVacantRoomSection(ctx, allRooms, allContracts, today);
        appendPaymentBehaviorSection(ctx, allInvoices, overdue, today);
        appendMissingInvoicesSection(ctx, allContracts, allInvoices);
        appendPropertyPerformanceSection(ctx, allProperties, roomsByPropertyId, allInvoices, overdue);

        appendStatSection(ctx, allRooms, allContracts, unpaid, overdue, allInvoices, today);

        String result = ctx.toString();
        cachedContext = result;
        cachedAt      = System.currentTimeMillis();
        return result;
    }

    // ── Core sections ──────────────────────────────────────────────────────────

    private void appendPropertySection(StringBuilder ctx, List<Property> properties,
                                       Map<Long, List<Room>> roomsByPropertyId) {
        ctx.append("--- KHU TRỌ (").append(properties.size()).append(" khu) ---\n");
        for (Property p : properties) {
            List<Room> rooms = roomsByPropertyId.getOrDefault(p.getId(), List.of());
            long avail = rooms.stream().filter(r -> r.getStatus() == Room.Status.AVAILABLE).count();
            long occ   = rooms.stream().filter(r -> r.getStatus() == Room.Status.OCCUPIED).count();
            long maint = rooms.stream().filter(r -> r.getStatus() == Room.Status.MAINTENANCE).count();
            ctx.append(String.format(
                    "• Khu #%d: %s | Địa chỉ: %s | Tổng: %d phòng (trống: %d, đang thuê: %d, bảo trì: %d)\n",
                    p.getId(), p.getName(), p.getAddress(), rooms.size(), avail, occ, maint));
        }
        ctx.append("\n");
    }

    private void appendRoomSection(StringBuilder ctx, List<Room> allRooms,
                                   Map<Long, Contract> activeByRoomId) {
        ctx.append("--- TẤT CẢ PHÒNG (").append(allRooms.size()).append(" phòng) ---\n");
        for (Room r : allRooms) {
            Contract ac = activeByRoomId.get(r.getId());
            String tenant = ac != null
                    ? String.format(" | Khách: %s (SĐT: %s, HĐ #%d)",
                            ac.getTenant().getFullName(), ac.getTenant().getPhone(), ac.getId())
                    : "";
            ctx.append(String.format(
                    "• Phòng #%d (%s) | Khu: %s | Trạng thái: %s | Giá: %,.0f đ/tháng | DT: %d m²%s\n",
                    r.getId(), r.getRoomNumber(), r.getProperty().getName(),
                    translateRoomStatus(r.getStatus()), r.getPrice(), r.getArea(), tenant));
        }
        ctx.append("\n");
    }

    private void appendTenantSection(StringBuilder ctx, List<Tenant> tenants,
                                     Map<Long, Contract> activeByTenantId) {
        ctx.append("--- DANH SÁCH KHÁCH THUÊ (").append(tenants.size()).append(" khách) ---\n");
        for (Tenant t : tenants) {
            Contract ac = activeByTenantId.get(t.getId());
            String info = ac != null
                    ? String.format(" | Đang thuê: Phòng %s - %s (đến %s, %,.0f đ/tháng)",
                            ac.getRoom().getRoomNumber(), ac.getRoom().getProperty().getName(),
                            ac.getEndDate().format(DATE_FMT), ac.getMonthlyRent())
                    : " | Không có hợp đồng hiện tại";
            ctx.append(String.format(
                    "• #%d %s | SĐT: %s | Email: %s | CCCD: %s%s\n",
                    t.getId(), t.getFullName(), t.getPhone(),
                    t.getEmail() != null ? t.getEmail() : "—",
                    t.getIdCardNumber() != null ? t.getIdCardNumber() : "—",
                    info));
        }
        ctx.append("\n");
    }

    private void appendContractSection(StringBuilder ctx, List<Contract> allContracts, LocalDate today) {
        List<Contract> active = allContracts.stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE)
                .sorted(Comparator.comparingLong(c -> ChronoUnit.DAYS.between(today, c.getEndDate())))
                .toList();

        ctx.append("--- HỢP ĐỒNG ĐANG HIỆU LỰC (").append(active.size()).append(" hợp đồng) ---\n");
        for (Contract c : active) {
            long daysLeft = ChronoUnit.DAYS.between(today, c.getEndDate());
            String warn = daysLeft <= 30 ? " [SAP HET HAN]" : (daysLeft <= 60 ? " [GAN HET HAN]" : "");
            ctx.append(String.format(
                    "• HĐ #%d | Phòng: %s - %s | Khách: %s | SĐT: %s | Thuê: %,.0f đ/tháng | %s → %s (còn %d ngày)%s\n",
                    c.getId(), c.getRoom().getRoomNumber(), c.getRoom().getProperty().getName(),
                    c.getTenant().getFullName(), c.getTenant().getPhone(), c.getMonthlyRent(),
                    c.getStartDate().format(DATE_FMT), c.getEndDate().format(DATE_FMT), daysLeft, warn));
        }
        ctx.append("\n");

        List<Contract> closed = allContracts.stream()
                .filter(c -> c.getStatus() != Contract.Status.ACTIVE)
                .sorted(Comparator.<Contract, LocalDate>comparing(Contract::getEndDate).reversed())
                .limit(10)
                .toList();
        if (!closed.isEmpty()) {
            ctx.append("--- HỢP ĐỒNG ĐÃ KẾT THÚC (10 gần nhất) ---\n");
            for (Contract c : closed) {
                ctx.append(String.format(
                        "• HĐ #%d | Phòng: %s - %s | Khách: %s | Trạng thái: %s | %s → %s\n",
                        c.getId(), c.getRoom().getRoomNumber(), c.getRoom().getProperty().getName(),
                        c.getTenant().getFullName(), translateContractStatus(c.getStatus()),
                        c.getStartDate().format(DATE_FMT), c.getEndDate().format(DATE_FMT)));
            }
            ctx.append("\n");
        }
    }

    private void appendInvoiceSection(StringBuilder ctx, List<Invoice> unpaid,
                                      List<Invoice> overdue, LocalDate today) {
        ctx.append("--- HÓA ĐƠN CHƯA THANH TOÁN (").append(unpaid.size()).append(" hóa đơn) ---\n");
        if (unpaid.isEmpty()) {
            ctx.append("Không có.\n");
        } else {
            for (Invoice i : unpaid) {
                ctx.append(String.format(
                        "• HD#%d | Phòng: %s - %s | Khách: %s | Tháng: %s | Tổng: %,.0f đ | Hạn: %s\n",
                        i.getId(), i.getContract().getRoom().getRoomNumber(),
                        i.getContract().getRoom().getProperty().getName(),
                        i.getContract().getTenant().getFullName(),
                        i.getBillingMonth().format(MONTH_FMT), i.getTotalAmount(),
                        i.getDueDate() != null ? i.getDueDate().format(DATE_FMT) : "—"));
            }
        }
        ctx.append("\n");

        ctx.append("--- HÓA ĐƠN QUÁ HẠN (").append(overdue.size()).append(" hóa đơn) ---\n");
        if (overdue.isEmpty()) {
            ctx.append("Không có.\n");
        } else {
            for (Invoice i : overdue) {
                long daysOver = i.getDueDate() != null ? ChronoUnit.DAYS.between(i.getDueDate(), today) : 0;
                ctx.append(String.format(
                        "• HD#%d | Phòng: %s - %s | Khách: %s | SĐT: %s | Tháng: %s | Tổng: %,.0f đ | Quá hạn: %d ngày\n",
                        i.getId(), i.getContract().getRoom().getRoomNumber(),
                        i.getContract().getRoom().getProperty().getName(),
                        i.getContract().getTenant().getFullName(),
                        i.getContract().getTenant().getPhone(),
                        i.getBillingMonth().format(MONTH_FMT), i.getTotalAmount(), daysOver));
            }
        }
        ctx.append("\n");
    }

    // ── Analytics sections ─────────────────────────────────────────────────────

    private void appendRevenueHistorySection(StringBuilder ctx, List<Invoice> allInvoices) {
        // Group PAID invoices by billing month — sorted newest first
        Map<YearMonth, BigDecimal> revenueByMonth = new TreeMap<>(Comparator.reverseOrder());
        Map<YearMonth, Integer>    countByMonth   = new HashMap<>();
        for (Invoice i : allInvoices) {
            if (i.getStatus() == Invoice.Status.PAID) {
                YearMonth ym = YearMonth.from(i.getBillingMonth());
                revenueByMonth.merge(ym, i.getTotalAmount(), BigDecimal::add);
                countByMonth.merge(ym, 1, Integer::sum);
            }
        }

        ctx.append("--- DOANH THU THEO THÁNG (12 THÁNG GẦN NHẤT) ---\n");
        if (revenueByMonth.isEmpty()) {
            ctx.append("Chưa có dữ liệu doanh thu.\n\n");
            return;
        }

        List<Map.Entry<YearMonth, BigDecimal>> entries = new ArrayList<>(revenueByMonth.entrySet());
        BigDecimal total12m = BigDecimal.ZERO;
        for (int idx = 0; idx < entries.size(); idx++) {
            YearMonth ym  = entries.get(idx).getKey();
            BigDecimal rev = entries.get(idx).getValue();
            int count = countByMonth.getOrDefault(ym, 0);
            total12m = total12m.add(rev);

            String trend = "";
            if (idx + 1 < entries.size()) {
                BigDecimal prev = entries.get(idx + 1).getValue();
                double pct = prev.compareTo(BigDecimal.ZERO) == 0 ? 0
                        : rev.subtract(prev).doubleValue() / prev.doubleValue() * 100;
                if (pct > 0.5)       trend = String.format(" (+%.1f%% so thang truoc)", pct);
                else if (pct < -0.5) trend = String.format(" (%.1f%% so thang truoc)", pct);
                else                 trend = " (bang thang truoc)";
            }
            ctx.append(String.format("• Tháng %s: %,.0f đ (%d hóa đơn)%s\n",
                    ym.format(MONTH_FMT), rev, count, trend));
        }
        ctx.append(String.format("  => Tổng 12 tháng: %,.0f đ\n", total12m));

        // Quarterly summary
        Map<String, BigDecimal> quarterly = new TreeMap<>(Comparator.reverseOrder());
        for (Map.Entry<YearMonth, BigDecimal> e : revenueByMonth.entrySet()) {
            YearMonth ym = e.getKey();
            String key = "Q" + ((ym.getMonthValue() - 1) / 3 + 1) + "/" + ym.getYear();
            quarterly.merge(key, e.getValue(), BigDecimal::add);
        }
        if (quarterly.size() > 1) {
            ctx.append("  Theo quý: ");
            quarterly.forEach((q, v) -> ctx.append(String.format("%s: %,.0f đ  ", q, v)));
            ctx.append("\n");
        }
        ctx.append("\n");
    }

    private void appendVacantRoomSection(StringBuilder ctx, List<Room> allRooms,
                                         List<Contract> allContracts, LocalDate today) {
        // Most recent contract end date per room (non-active contracts)
        Map<Long, LocalDate> lastEndByRoomId = new HashMap<>();
        for (Contract c : allContracts) {
            if (c.getStatus() != Contract.Status.ACTIVE) {
                Long rid = c.getRoom().getId();
                LocalDate cur = lastEndByRoomId.get(rid);
                if (cur == null || c.getEndDate().isAfter(cur)) {
                    lastEndByRoomId.put(rid, c.getEndDate());
                }
            }
        }

        List<Room> vacantRooms = allRooms.stream()
                .filter(r -> r.getStatus() == Room.Status.AVAILABLE)
                .toList();
        if (vacantRooms.isEmpty()) return;

        record VacantInfo(Room room, long days, LocalDate since, boolean hadContract) {}
        List<VacantInfo> infos = vacantRooms.stream()
                .map(r -> {
                    LocalDate lastEnd = lastEndByRoomId.get(r.getId());
                    boolean hadContract = lastEnd != null;
                    LocalDate since = hadContract ? lastEnd : r.getCreatedAt().toLocalDate();
                    return new VacantInfo(r, ChronoUnit.DAYS.between(since, today), since, hadContract);
                })
                .sorted(Comparator.comparingLong(VacantInfo::days).reversed())
                .toList();

        ctx.append("--- PHÂN TÍCH PHÒNG ĐANG TRỐNG ---\n");
        BigDecimal lostMonthlyPotential = BigDecimal.ZERO;
        for (VacantInfo vi : infos) {
            String label = vi.hadContract()
                    ? "HĐ cuối kết thúc " + vi.since().format(DATE_FMT)
                    : "Chưa từng có HĐ (từ " + vi.since().format(DATE_FMT) + ")";
            String urgency = vi.days() >= 90 ? " [TRONG THOI GIAN QUA DAI - CAN XU LY]"
                           : vi.days() >= 60 ? " [TRONG LAU - CAN CHU Y]"
                           : vi.days() >= 30 ? " [DA TRONG 1 THANG]"
                           : "";
            lostMonthlyPotential = lostMonthlyPotential.add(vi.room().getPrice());
            ctx.append(String.format(
                    "• Phòng %s - %s | Giá: %,.0f đ/tháng | Trống: %d ngày (%s)%s\n",
                    vi.room().getRoomNumber(), vi.room().getProperty().getName(),
                    vi.room().getPrice(), vi.days(), label, urgency));
        }
        ctx.append(String.format("  => Doanh thu tiềm năng bị bỏ lỡ mỗi tháng: %,.0f đ\n", lostMonthlyPotential));
        ctx.append("\n");
    }

    private void appendPaymentBehaviorSection(StringBuilder ctx, List<Invoice> allInvoices,
                                              List<Invoice> currentOverdue, LocalDate today) {
        // Current OVERDUE count per tenant
        Map<Long, Long> overdueCountByTenant = currentOverdue.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getContract().getTenant().getId(), Collectors.counting()));

        // Historical late payments: PAID but paidAt > dueDate
        Map<Long, List<Long>> latePayDaysByTenant = new HashMap<>();
        for (Invoice i : allInvoices) {
            if (i.getStatus() == Invoice.Status.PAID
                    && i.getPaidAt() != null && i.getDueDate() != null
                    && i.getPaidAt().toLocalDate().isAfter(i.getDueDate())) {
                Long tid = i.getContract().getTenant().getId();
                long daysLate = ChronoUnit.DAYS.between(i.getDueDate(), i.getPaidAt().toLocalDate());
                latePayDaysByTenant.computeIfAbsent(tid, k -> new ArrayList<>()).add(daysLate);
            }
        }

        Set<Long> problemTenants = new HashSet<>();
        problemTenants.addAll(overdueCountByTenant.keySet());
        problemTenants.addAll(latePayDaysByTenant.keySet());

        ctx.append("--- PHÂN TÍCH HÀNH VI THANH TOÁN ---\n");
        if (problemTenants.isEmpty()) {
            ctx.append("Tất cả khách thuê đều thanh toán đúng hạn trong 12 tháng qua.\n\n");
            return;
        }

        // Tenant name/phone lookup from both sources
        Map<Long, String> nameById  = new HashMap<>();
        Map<Long, String> phoneById = new HashMap<>();
        for (Invoice i : allInvoices) {
            Tenant t = i.getContract().getTenant();
            nameById.put(t.getId(), t.getFullName());
            phoneById.put(t.getId(), t.getPhone());
        }
        for (Invoice i : currentOverdue) {
            Tenant t = i.getContract().getTenant();
            nameById.put(t.getId(), t.getFullName());
            phoneById.put(t.getId(), t.getPhone());
        }

        // Sort: most problematic first (overdue count, then late count)
        List<Long> sorted = new ArrayList<>(problemTenants);
        sorted.sort((a, b) -> {
            int cmp = Long.compare(
                    overdueCountByTenant.getOrDefault(b, 0L),
                    overdueCountByTenant.getOrDefault(a, 0L));
            if (cmp != 0) return cmp;
            return Integer.compare(
                    latePayDaysByTenant.getOrDefault(b, List.of()).size(),
                    latePayDaysByTenant.getOrDefault(a, List.of()).size());
        });

        for (Long tid : sorted) {
            String name  = nameById.getOrDefault(tid, "#" + tid);
            String phone = phoneById.getOrDefault(tid, "—");
            long overdueCount = overdueCountByTenant.getOrDefault(tid, 0L);
            List<Long> lateDays = latePayDaysByTenant.getOrDefault(tid, List.of());

            StringBuilder detail = new StringBuilder();
            if (overdueCount > 0)
                detail.append(String.format("hiện đang quá hạn %d hóa đơn", overdueCount));
            if (!lateDays.isEmpty()) {
                long avg = lateDays.stream().mapToLong(Long::longValue).sum() / lateDays.size();
                long max = lateDays.stream().mapToLong(Long::longValue).max().orElse(0);
                if (!detail.isEmpty()) detail.append(", ");
                detail.append(String.format("lịch sử trễ %d lần (TB %d ngày, tối đa %d ngày)", lateDays.size(), avg, max));
            }
            ctx.append(String.format("• %s | SĐT: %s | %s\n", name, phone, detail));
        }
        ctx.append("\n");
    }

    private void appendMissingInvoicesSection(StringBuilder ctx, List<Contract> allContracts,
                                              List<Invoice> allInvoices) {
        YearMonth currentMonth = YearMonth.now();

        Set<Long> hasInvoiceThisMonth = allInvoices.stream()
                .filter(i -> YearMonth.from(i.getBillingMonth()).equals(currentMonth))
                .map(i -> i.getContract().getId())
                .collect(Collectors.toSet());

        List<Contract> missing = allContracts.stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE
                        && !hasInvoiceThisMonth.contains(c.getId()))
                .toList();

        ctx.append(String.format("--- HÓA ĐƠN CHƯA TẠO THÁNG %s ---\n", currentMonth.format(MONTH_FMT)));
        if (missing.isEmpty()) {
            ctx.append("Tất cả hợp đồng hiệu lực đã có hóa đơn tháng này.\n");
        } else {
            ctx.append(String.format("%d hợp đồng chưa được tạo hóa đơn:\n", missing.size()));
            for (Contract c : missing) {
                ctx.append(String.format(
                        "• HĐ #%d | Phòng: %s - %s | Khách: %s | SĐT: %s | Thuê: %,.0f đ/tháng\n",
                        c.getId(), c.getRoom().getRoomNumber(), c.getRoom().getProperty().getName(),
                        c.getTenant().getFullName(), c.getTenant().getPhone(), c.getMonthlyRent()));
            }
        }
        ctx.append("\n");
    }

    private void appendPropertyPerformanceSection(StringBuilder ctx, List<Property> allProperties,
                                                  Map<Long, List<Room>> roomsByPropertyId,
                                                  List<Invoice> allInvoices,
                                                  List<Invoice> overdue) {
        YearMonth currentMonth = YearMonth.now();

        // Revenue this month per property
        Map<Long, BigDecimal> revThisMonthByProp = new HashMap<>();
        Map<Long, BigDecimal> revLastMonthByProp = new HashMap<>();
        YearMonth lastMonth = currentMonth.minusMonths(1);
        for (Invoice i : allInvoices) {
            if (i.getStatus() != Invoice.Status.PAID) continue;
            Long propId = i.getContract().getRoom().getProperty().getId();
            YearMonth bm = YearMonth.from(i.getBillingMonth());
            if (bm.equals(currentMonth))
                revThisMonthByProp.merge(propId, i.getTotalAmount(), BigDecimal::add);
            else if (bm.equals(lastMonth))
                revLastMonthByProp.merge(propId, i.getTotalAmount(), BigDecimal::add);
        }

        // Overdue debt per property
        Map<Long, BigDecimal> debtByProp = new HashMap<>();
        for (Invoice i : overdue) {
            Long propId = i.getContract().getRoom().getProperty().getId();
            debtByProp.merge(propId, i.getTotalAmount(), BigDecimal::add);
        }

        ctx.append("--- HIỆU SUẤT THEO KHU TRỌ ---\n");
        for (Property p : allProperties) {
            List<Room> rooms = roomsByPropertyId.getOrDefault(p.getId(), List.of());
            long total    = rooms.size();
            long occupied = rooms.stream().filter(r -> r.getStatus() == Room.Status.OCCUPIED).count();
            double rate   = total > 0 ? occupied * 100.0 / total : 0;

            BigDecimal thisMon  = revThisMonthByProp.getOrDefault(p.getId(), BigDecimal.ZERO);
            BigDecimal lastMon  = revLastMonthByProp.getOrDefault(p.getId(), BigDecimal.ZERO);
            BigDecimal debt     = debtByProp.getOrDefault(p.getId(), BigDecimal.ZERO);
            BigDecimal potential = rooms.stream().map(Room::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);

            String revTrend = "";
            if (lastMon.compareTo(BigDecimal.ZERO) > 0) {
                double pct = thisMon.subtract(lastMon).doubleValue() / lastMon.doubleValue() * 100;
                revTrend = pct >= 0 ? String.format(" (+%.1f%%)", pct) : String.format(" (%.1f%%)", pct);
            }

            ctx.append(String.format(
                    "• %s | Lấp đầy: %.0f%% (%d/%d phòng) | Thu tháng này: %,.0f đ%s | Nợ QH: %,.0f đ | Tiềm năng: %,.0f đ/tháng\n",
                    p.getName(), rate, occupied, total, thisMon, revTrend, debt, potential));
        }
        ctx.append("\n");
    }

    private void appendStatSection(StringBuilder ctx, List<Room> allRooms, List<Contract> allContracts,
                                   List<Invoice> unpaid, List<Invoice> overdue,
                                   List<Invoice> allInvoices, LocalDate today) {
        long totalRooms    = allRooms.size();
        long occupiedRooms = allRooms.stream().filter(r -> r.getStatus() == Room.Status.OCCUPIED).count();
        long availRooms    = allRooms.stream().filter(r -> r.getStatus() == Room.Status.AVAILABLE).count();
        long maintRooms    = allRooms.stream().filter(r -> r.getStatus() == Room.Status.MAINTENANCE).count();
        long activeContracts = allContracts.stream().filter(c -> c.getStatus() == Contract.Status.ACTIVE).count();
        long expiring30 = allContracts.stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE)
                .filter(c -> {
                    long d = ChronoUnit.DAYS.between(today, c.getEndDate());
                    return d >= 0 && d <= 30;
                }).count();

        BigDecimal totalUnpaid  = unpaid.stream().map(Invoice::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalOverdue = overdue.stream().map(Invoice::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        YearMonth cm = YearMonth.now();
        BigDecimal paidThisMonth = allInvoices.stream()
                .filter(i -> i.getStatus() == Invoice.Status.PAID
                        && YearMonth.from(i.getBillingMonth()).equals(cm))
                .map(Invoice::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Theoretical monthly revenue from all active contracts
        BigDecimal monthlyPotential = allContracts.stream()
                .filter(c -> c.getStatus() == Contract.Status.ACTIVE)
                .map(Contract::getMonthlyRent).reduce(BigDecimal.ZERO, BigDecimal::add);

        double occupancy = totalRooms > 0 ? occupiedRooms * 100.0 / totalRooms : 0;

        ctx.append("--- THỐNG KÊ TỔNG QUAN ---\n");
        ctx.append(String.format("• Tổng phòng: %d | Đang thuê: %d | Trống: %d | Bảo trì: %d\n",
                totalRooms, occupiedRooms, availRooms, maintRooms));
        ctx.append(String.format("• Tỷ lệ lấp đầy: %.1f%%\n", occupancy));
        ctx.append(String.format("• Hợp đồng hiệu lực: %d | Sắp hết hạn (30 ngày): %d\n",
                activeContracts, expiring30));
        ctx.append(String.format("• Hóa đơn chưa thu: %d | Tổng: %,.0f đ\n", unpaid.size(), totalUnpaid));
        ctx.append(String.format("• Hóa đơn quá hạn: %d | Tổng: %,.0f đ\n", overdue.size(), totalOverdue));
        ctx.append(String.format("• Đã thu tháng %s: %,.0f đ\n", cm.format(MONTH_FMT), paidThisMonth));
        ctx.append(String.format("• Doanh thu lý thuyết mỗi tháng (HĐ hiệu lực): %,.0f đ\n", monthlyPotential));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private String translateRoomStatus(Room.Status status) {
        return switch (status) {
            case AVAILABLE   -> "Còn trống";
            case OCCUPIED    -> "Đang thuê";
            case MAINTENANCE -> "Bảo trì";
        };
    }

    private String translateContractStatus(Contract.Status status) {
        return switch (status) {
            case ACTIVE     -> "Đang hiệu lực";
            case EXPIRED    -> "Đã hết hạn";
            case TERMINATED -> "Đã chấm dứt";
        };
    }
}
