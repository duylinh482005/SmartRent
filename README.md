# SmartRent — Hệ thống quản lý nhà trọ thông minh

SmartRent là ứng dụng web full-stack hỗ trợ chủ nhà trọ quản lý toàn bộ hoạt động cho thuê phòng theo hướng tự động hóa: từ tiếp nhận khách, lập hợp đồng, phát hóa đơn hàng tháng, xử lý vi phạm thanh toán, đến theo dõi tài chính — kết hợp trợ lý AI phân tích dữ liệu thực tế và đưa ra cảnh báo thông minh.

---

## Stack công nghệ

| | Frontend | Backend |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Spring Boot 3 + Java 17 |
| State / Query | TanStack Query + Zustand | JPA / Hibernate |
| Auth | JWT (localStorage) + Axios interceptor | Stateless JWT filter + BCrypt |
| AI | — | Spring AI + Groq (`llama-3.3-70b-versatile`) |
| PDF | — | iText (`PdfService`) |
| Scheduler | — | `@EnableScheduling` (cron Asia/Ho_Chi_Minh) |
| Database | — | MySQL |

---

## Cấu trúc repo

```
TTCS/
├── smartrent/src/main/java/com/smartrent/
│   ├── controller/
│   ├── entity/
│   ├── dto/request|response/
│   ├── repository/
│   ├── service/impl/
│   └── SmartrentApplication.java
└── smartrent-fe/src/
    ├── api/
    ├── pages/
    ├── store/
    ├── types/
    └── utils/
```

---

## Các chức năng chính

- **Quản lý khu trọ & phòng** — thêm/sửa/xóa khu trọ và phòng; tự động cập nhật trạng thái phòng (`AVAILABLE` / `OCCUPIED`) theo vòng đời hợp đồng.
- **Quản lý khách thuê** — lưu thông tin định danh (họ tên, CCCD, SĐT); kiểm tra trùng lặp; theo dõi lịch sử vi phạm thanh toán.
- **Quản lý hợp đồng** — tạo hợp đồng (tối thiểu 6 tháng), gia hạn, chấm dứt thủ công (yêu cầu không còn nợ tồn đọng).
- **Quản lý hóa đơn** — tự động tạo hóa đơn ngày 1 hàng tháng; tính tiền theo điện/nước/dịch vụ/số người; hóa đơn tháng đầu tính theo ngày còn lại và bao gồm tiền cọc; xuất PDF kèm mã QR chuyển khoản.
- **Xử lý vi phạm tự động** — hóa đơn quá 5 ngày chưa thanh toán → `OVERDUE`; phạt 100.000đ/ngày, trừ vào tiền cọc; quá 3 ngày → tự động chấm dứt hợp đồng, phòng về `AVAILABLE`, ghi nhận vi phạm vào hồ sơ khách thuê.
- **Quản lý chi phí vận hành** — ghi nhận chi phí theo danh mục (sửa chữa, điện chung, dịch vụ...); tổng hợp vào báo cáo tài chính.
- **Dashboard tài chính** — KPI doanh thu / chi phí / lợi nhuận tháng hiện tại; biểu đồ grouped bar 6 tháng gần nhất; phân bổ chi phí theo danh mục; danh sách phòng chưa có hóa đơn tháng này.
- **Trợ lý AI** — phân tích dữ liệu nội bộ thực tế (hợp đồng, hóa đơn, chi phí, khách thuê); cảnh báo chủ động (hóa đơn quá hạn, hợp đồng sắp hết hạn, phòng thiếu hóa đơn); hỗ trợ đặt câu hỏi bằng ngôn ngữ tự nhiên.

---

## Cron jobs

| Giờ chạy | Hành động |
|---|---|
| `00:05` hàng ngày | Hợp đồng `ACTIVE` có `endDate < hôm nay` → `EXPIRED`; phòng → `AVAILABLE` |
| `00:10` hàng ngày | (1) Hóa đơn `UNPAID` có `dueDate < hôm nay` → `OVERDUE` · (2) Cộng `overdueDays`, tính `lateFee`, trừ `depositBalance` · (3) Nếu `overdueDays ≥ 3` → tự động terminate hợp đồng, mark toàn bộ hóa đơn `PAID` (`system:deposit-forfeited`), cập nhật hồ sơ khách thuê |

---

## Luồng trạng thái

```
Room:     AVAILABLE ──[tạo HĐ]──▶ OCCUPIED ──[terminate / expire]──▶ AVAILABLE

Contract: ACTIVE ──[00:05, hết hạn tự nhiên]──────────────▶ EXPIRED
          ACTIVE ──[terminate thủ công, không còn nợ]──────▶ TERMINATED
          ACTIVE ──[00:10, overdueDays ≥ 3]────────────────▶ TERMINATED

Invoice:  UNPAID ──[00:10, dueDate < today]──▶ OVERDUE
          UNPAID / OVERDUE ──[mark-paid thủ công]──▶ PAID
          OVERDUE ──[00:10, ≥ 3 ngày]──▶ PAID (system:deposit-forfeited)
```

---

## Khởi chạy

```bash
# Backend
cd smartrent
./mvnw spring-boot:run -Dspring-boot.run.profiles=ai-groq-mysql

# Frontend
cd smartrent-fe
npm install
npm run dev
```

Yêu cầu: Java 17+, Node 18+, MySQL 8.

---

## Biến môi trường

| Biến | Mô tả |
|---|---|
| `GROQ_API_KEY` | Groq API key (lấy tại console.groq.com) |
| `DB_URL` | JDBC URL kết nối MySQL |
| `DB_USERNAME` | Username MySQL |
| `DB_PASSWORD` | Password MySQL |
