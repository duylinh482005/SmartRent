# SmartRent — Context cho Claude Code

Đọc README.md để hiểu toàn bộ dự án (stack, entities, business rules, cron jobs).

## Việc đang làm / tiếp theo

**Tính năng cần implement tiếp: Gửi email hóa đơn PDF tự động (Section "VIỆC TIẾP THEO" trong README.md)**

Tóm tắt: thêm `spring-boot-starter-mail`, tạo `EmailService` + `EmailServiceImpl`, thêm scheduler 08:00 vào `InvoiceServiceImpl` để gửi PDF đến email khách thuê trước 2 ngày đến hạn.

## Lưu ý quan trọng khi làm việc với codebase này

- `ddl-auto=update` — column mới thêm vào entity có sẵn sẽ NULL với row cũ trong DB. Luôn dùng boxed type (Integer, BigDecimal) và null-check ở service, không dùng primitive cho các field có thể null.
- Mọi repository query business phải có đuôi `AndDeletedFalse` (soft delete toàn hệ thống).
- `@Scheduled` cron timezone khai báo rõ `zone = "Asia/Ho_Chi_Minh"`.
- Backend lỗi runtime đều bị `GlobalExceptionHandler` bắt → trả `{ message: "..." }` → FE toast tự hiển thị.
- FE base URL hard-code `http://localhost:8080/api/v1` trong `axiosClient`.
