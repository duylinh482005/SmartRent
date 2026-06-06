# SmartRent — Tài liệu kỹ thuật

> Cập nhật: 2026-06-06

## Stack

| | Frontend | Backend |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Spring Boot 3 + Java 17 |
| State/Query | TanStack Query (`staleTime: 30s`) + Zustand | JPA/Hibernate, `ddl-auto=update` |
| Auth | JWT lưu `localStorage`, interceptor tự inject | Stateless JWT filter, BCrypt |
| HTTP | `axiosClient` → `http://localhost:8080/api/v1` | REST, `GlobalExceptionHandler` |
| AI | — | Spring AI + Groq (`llama-3.3-70b-versatile`) |
| PDF | — | iText / `PdfService` (đã hoạt động) |
| Scheduler | — | `@EnableScheduling` bật trên `SmartrentApplication` |

---

## Cấu trúc repo

```
TTCS/
├── smartrent/smartrent/src/main/java/com/smartrent/
│   ├── controller/   entity/   dto/request|response/
│   ├── repository/   service/impl/
│   └── SmartrentApplication.java
├── smartrent-fe/src/
│   ├── api/   pages/   store/   types/   utils/
└── README.md   CLAUDE.md
```

---

## Entities — chỉ các field quan trọng / không derivable

### Contract
- `depositBalance` (BigDecimal) — tiền cọc còn lại; khởi tạo = `monthlyRent` khi tạo HĐ; giảm dần theo phạt quá hạn; về 0 khi hệ thống tự terminate.

### Invoice
- `dueDate` = `LocalDate.now().plusDays(5)` tính từ lúc tạo (không phải cuối tháng)
- `lateFee` (BigDecimal) — phải dùng **boxed**, nullable với row cũ
- `overdueDays` (Integer) — phải dùng **Integer không phải int** vì cột mới NULL với row cũ trong DB (ddl-auto=update không thêm DEFAULT)
- `notificationSent` / `notificationSentAt` — cờ đã gửi email; dùng cho scheduler email (chưa implement)
- `paymentConfirmedBy` — có thể là username hoặc `"system:deposit-forfeited"` khi hệ thống tự thanh toán

### Tenant
- `latePaymentCount`, `totalLateDays`, `lastLatePaymentDate` — tracking trễ hạn cho AI; tăng khi hợp đồng tự terminate vì quá hạn

---

## Business rules không derivable từ code

- **Uniqueness check tenant** dùng `AndDeletedFalse` — tenant đã soft-delete không tính vào check trùng phone/CCCD
- **billingMonth** luôn normalize về ngày 1 (`withDayOfMonth(1)`) ngay đầu service
- **servicePeople** lấy từ `contract.numberOfPeople`, không nhận từ request FE
- **Chặn xóa Contract có lịch sử PAID** — lưu để đối soát tài chính (không xóa dù đã TERMINATED/EXPIRED)
- **Chặn terminate Contract còn nợ** — kiểm tra `sumOutstandingByContractId` bao gồm cả OVERDUE
- **`ownerId: 1` hardcode** trong `PropertyPage.tsx` khi tạo/sửa — chưa lấy theo user đang đăng nhập

---

## Cron jobs (Asia/Ho_Chi_Minh)

| Cron | Giờ | Method | Hành động |
|---|---|---|---|
| `0 5 0 * * *` | 00:05 | `ContractServiceImpl#expireContractsDaily` | ACTIVE có `endDate < today` → EXPIRED; room → AVAILABLE |
| `0 10 0 * * *` | 00:10 | `InvoiceServiceImpl#updateOverdueInvoicesDaily` | 3 bước phạt (xem bên dưới) |

### Logic 3 bước của scheduler 00:10

1. UNPAID có `dueDate < today` → OVERDUE
2. Group OVERDUE theo contract: `overdueDays += 1`, `lateFee += 100.000đ`, `contract.depositBalance -= 100.000đ` (sàn 0)
3. Nếu bất kỳ invoice nào `overdueDays >= 3` → terminate:
   - contract → TERMINATED, room → AVAILABLE
   - Toàn bộ OVERDUE invoice → PAID (`paymentConfirmedBy = "system:deposit-forfeited"`)
   - `contract.depositBalance = 0`
   - Tenant: `latePaymentCount++`, `totalLateDays += overdueDays`, `lastLatePaymentDate = today`

**Hằng số:** `DAILY_LATE_FEE = 100_000`, `AUTO_TERMINATE_DAYS = 3`

**UI penalty** (đỏ, dòng phạt) chỉ hiện sau khi scheduler chạy lần đầu kể từ khi invoice OVERDUE.

---

## Luồng trạng thái

```
Room:    AVAILABLE ──[tạo HĐ]──▶ OCCUPIED ──[terminate/expire HĐ]──▶ AVAILABLE

Contract: ACTIVE ──[00:05]──▶ EXPIRED
          ACTIVE ──[terminate thủ công, không còn nợ]──▶ TERMINATED
          ACTIVE ──[00:10, overdueDays >= 3]──▶ TERMINATED

Invoice:  UNPAID ──[00:10, dueDate < today]──▶ OVERDUE
          UNPAID/OVERDUE ──[mark-paid]──▶ PAID
          OVERDUE ──[00:10, >= 3 ngày]──▶ PAID (system:deposit-forfeited)
```

---

## Đã hoàn thành gần đây

| Ngày | Việc |
|---|---|
| 2026-06-06 | **Dashboard nâng cấp** — thêm 3 KPI tài chính (doanh thu / chi phí / lợi nhuận ròng tháng hiện tại kèm % so tháng trước), biểu đồ grouped bar doanh thu vs chi phí 6 tháng, panel chi phí theo danh mục tháng này ở góc dưới phải |
| 2026-06-06 | **Bug fix ExpensePage** — dropdown tháng bị mất option khi đang lọc tháng; fix bằng cách tách query riêng `['expenses-all']` không có date filter để build `monthOptions` |
| 2026-06-06 | **Bug fix ContractResponse** — thiếu field `depositBalance` khiến `ContractServiceImpl:329` compile error; đã thêm `private BigDecimal depositBalance` vào DTO |
| 2026-06-05 | **Mock data 6 tháng** — seed 2 khu trọ, 11 phòng, 9 khách thuê, 9 hợp đồng, 54 hóa đơn (T12/2025–T5/2026), 33 khoản chi phí; 9 hóa đơn T5/2026 đang UNPAID |

---

## VIỆC TIẾP THEO

---

### A. Gửi email hóa đơn PDF

**Approach:** Scheduler 08:00 tự động + nút gửi thủ công trên UI. Tách SMTP khỏi transaction tạo hóa đơn; retry được; field `notificationSent` đã có sẵn.

#### Backend

| File | Việc |
|---|---|
| `pom.xml` | Thêm `spring-boot-starter-mail` |
| `application.properties` | Thêm SMTP config (Gmail App Password) |
| `EmailService.java` (mới) | Interface: `sendInvoicePdf(String toEmail, String tenantName, Invoice invoice, byte[] pdf)` |
| `EmailServiceImpl.java` (mới) | `JavaMailSender` + `MimeMessage` + PDF đính kèm |
| `InvoiceRepository.java` | Thêm query `findByStatusAndDueDateAndNotificationSentFalseAndDeletedFalse` |
| `InvoiceServiceImpl.java` | Scheduler 08:00 gửi tự động + `sendEmailNotification(Long id)` + `sendAllUnpaidEmailNotifications()` |
| `InvoiceController.java` | `POST /{id}/send-email` và `POST /send-all-unpaid-emails` |

```properties
# application.properties — SMTP Gmail
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=YOUR_GMAIL@gmail.com
spring.mail.password=YOUR_APP_PASSWORD
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
```
> App Password: myaccount.google.com → Security → 2-Step Verification → App passwords

**Lưu ý quan trọng:** `PdfService.generateInvoicePdf()` thực tế nhận `(InvoiceResponse invoice, PdfService.OwnerInfo owner)` — **không phải** `(Long invoiceId)` như README cũ ghi. Cần build `InvoiceResponse` và `OwnerInfo` từ contract/property trước khi gọi PDF.

**Scheduler 08:00:**
```java
@Scheduled(cron = "0 0 8 * * *", zone = "Asia/Ho_Chi_Minh")
public void sendInvoiceNotificationsDaily() {
    // Tìm UNPAID có dueDate = hôm nay + 2 và chưa gửi
    // Gọi pdfService → emailService → đánh dấu notificationSent = true
}
```

#### Frontend

| File | Việc |
|---|---|
| `InvoicePage.tsx` (list) | Bỏ nút "Tải PDF" → thay bằng nút "Gửi mail" (chỉ hiện với UNPAID) |
| `InvoicePage.tsx` (list) | Thêm nút "Gửi tất cả" — chỉ gửi UNPAID, idempotent (đã gửi thì skip) |
| `InvoiceDetailPage.tsx` | Giữ nguyên nút "Xuất PDF" |

---

### B. Nâng cấp AI — từ reactive sang proactive

**Triết lý:** AI không làm CRUD (đã có nút bấm). AI làm những gì UI không làm được: tổng hợp, phân tích, dự báo, cảnh báo chủ động.

#### B1. Bỏ CRUD actions khỏi AI

Xóa khỏi `AiServiceImpl`:
- `handleMarkAsPaid` — dùng nút bấm
- `handleTerminateContract` — dùng nút bấm (có confirm dialog)
- `handleEditContract` — dùng form UI
- `handleRoomStatus` — dùng nút bấm

Dọn `SYSTEM_PROMPT`: xóa toàn bộ section "HÀNH ĐỘNG TRỰC TIẾP".

#### B2. Thêm vào `AiContextServiceImpl`

| Section mới | Dữ liệu | Tại sao |
|---|---|---|
| Hóa đơn đến hạn 7 ngày tới | UNPAID có `dueDate` trong [today, today+7] | Thứ chủ trọ cần biết nhất mỗi sáng — đang thiếu hoàn toàn |
| Risk score tenant | Tính từ `latePaymentCount`, `totalLateDays`, OVERDUE hiện tại | AI đưa label RỦI RO CAO / TRUNG BÌNH / ĐÁNG TIN CẬY |
| Dự báo doanh thu tháng tới | Từ HĐ hiệu lực × lịch sử thanh toán | UI không có màn hình nào làm được |

#### B3. Cập nhật `SYSTEM_PROMPT`

- **Proactive briefing khi `history` rỗng:** Khi người dùng gửi tin nhắn đầu tiên trong phiên (history rỗng), AI luôn mở đầu bằng tóm tắt tình hình hôm nay trước khi trả lời câu hỏi:
  ```
  "Hôm nay [ngày]:
  - X hóa đơn đến hạn trong 7 ngày tới
  - Y hợp đồng sắp hết hạn (≤30 ngày)
  - Z phòng trống đang mất doanh thu
  - [Tình trạng tốt nếu không có vấn đề gì]"
  ```
- **Tư vấn dựa trên số liệu thực**, không phải lời khuyên chung chung.
- **Risk label** rõ ràng khi đề cập tenant.
- **Dự báo doanh thu** khi được hỏi về tài chính tháng tới.

---

## Vấn đề còn tồn tại

| Vị trí | Vấn đề |
|---|---|
| `PropertyPage.tsx` | `ownerId: 1` hardcode khi tạo/sửa |
| `SecurityConfig.java` | Không phân quyền theo role, chỉ check authenticated |
| DB prod | Column mới (`late_fee`, `overdue_days`, `deposit_balance`, v.v.) được thêm qua `ddl-auto=update` — row cũ NULL, cần null-safe code |
