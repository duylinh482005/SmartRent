# SmartRent — Tài liệu Kỹ thuật Tổng hợp

> Phiên bản cập nhật: 2026-06-02
> Dùng cho: onboarding, debug, phân tích nghiệp vụ, Claude Code context

---

## Mục lục

1. [Tổng quan stack](#1-tổng-quan-stack)
2. [Cấu trúc repo](#2-cấu-trúc-repo)
3. [Entities & quan hệ dữ liệu](#3-entities--quan-hệ-dữ-liệu)
4. [Luồng xác thực](#4-luồng-xác-thực)
5. [Dashboard](#5-dashboard)
6. [Khu trọ (Property)](#6-khu-trọ-property)
7. [Phòng (Room)](#7-phòng-room)
8. [Khách thuê (Tenant)](#8-khách-thuê-tenant)
9. [Hợp đồng (Contract)](#9-hợp-đồng-contract)
10. [Hóa đơn (Invoice)](#10-hóa-đơn-invoice)
11. [AI Assistant](#11-ai-assistant)
12. [Cron jobs & tự động hóa](#12-cron-jobs--tự-động-hóa)
13. [Soft delete — quy ước toàn hệ thống](#13-soft-delete--quy-ước-toàn-hệ-thống)
14. [Business rules tổng hợp](#14-business-rules-tổng-hợp)
15. [Vấn đề còn tồn tại](#15-vấn-đề-còn-tồn-tại)
16. [Lịch sử nâng cấp](#16-lịch-sử-nâng-cấp)

---

## 1. Tổng quan stack

| | Frontend | Backend |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Spring Boot 3 + Java 17 |
| State | TanStack Query (`staleTime: 30s`) + Zustand | JPA/Hibernate |
| Auth | JWT lưu `localStorage`, interceptor tự inject | Stateless JWT filter, BCrypt |
| HTTP | `axiosClient` → `http://localhost:8080/api/v1` | REST, `GlobalExceptionHandler` |
| UI | Tailwind CSS + lucide-react | — |
| Biểu đồ | Recharts (`BarChart`, `Bar`, `shape` prop) | — |
| PDF | — | iText / PdfService |
| AI | — | Spring AI + Groq (`llama-3.3-70b-versatile`) |
| Favicon | `/public/favicon.svg` (chữ "SR" trắng trên nền xanh #2563eb) | — |
| Tab title | `SmartRent` (`index.html`) | — |

**Điểm quan trọng cho Claude Code:**
- FE base URL hard-code `http://localhost:8080/api/v1` trong `axiosClient`.
- `@EnableScheduling` đã bật trên `SmartrentApplication` — cron job chạy tự động.
- Mọi lỗi runtime backend đều bị `GlobalExceptionHandler` bắt và trả `{ message: "..." }`.
- FE hiển thị `message` từ backend qua toast (interceptor `axiosClient`).

---

## 2. Cấu trúc repo

```
TTCS/
├── smartrent/smartrent/         # Spring Boot backend
│   └── src/main/java/com/smartrent/
│       ├── config/              # AppConfig, SecurityConfig, StaticResourceConfig
│       ├── controller/          # REST controllers
│       ├── dto/                 # request/, response/
│       ├── entity/              # JPA entities
│       ├── repository/          # Spring Data JPA
│       ├── service/             # interfaces + impl/
│       └── SmartrentApplication.java
├── smartrent-fe/                # React frontend
│   ├── public/favicon.svg       # SR logo SVG
│   ├── index.html               # title = SmartRent
│   └── src/
│       ├── api/                 # axiosClient + domain APIs
│       ├── pages/               # route-level components
│       ├── store/               # Zustand (authStore)
│       ├── types/               # TypeScript interfaces
│       └── utils/               # format.ts, v.v.
└── README.md
```

---

## 3. Entities & quan hệ dữ liệu

### Quan hệ tổng quát

```
User (chủ trọ)
 └── Property (khu trọ) [soft delete]
      └── Room (phòng) [soft delete]
           └── Contract (hợp đồng) [soft delete]
                ├── Tenant (khách thuê) [soft delete]
                └── Invoice (hóa đơn) [soft delete]
```

### BaseEntity (kế thừa bởi tất cả entity)

```java
@CreatedDate  LocalDateTime createdAt;
@LastModifiedDate LocalDateTime updatedAt;
```

### Property

| Field | Type | Ghi chú |
|---|---|---|
| `owner` | `User` | ManyToOne LAZY |
| `name` | String | unique theo owner |
| `address` | String | |
| `electricUnitPrice` | BigDecimal | default 3500 |
| `waterUnitPrice` | BigDecimal | default 15000 |
| `serviceUnitPrice` | BigDecimal | default 0 |
| `networkFee` | BigDecimal | default 0 |
| `rooms` | `List<Room>` | CascadeType.ALL + orphanRemoval |
| `deleted` / `deletedAt` / `deletedBy` | soft delete | cột `is_deleted` |

### Room

| Field | Type | Ghi chú |
|---|---|---|
| `property` | `Property` | ManyToOne LAZY |
| `roomNumber` | String | unique trong cùng property |
| `price` | BigDecimal | |
| `status` | Enum | `AVAILABLE` / `OCCUPIED` / `MAINTENANCE` |
| `area` | Integer | m² |
| `imageUrl` | String (LONGTEXT) | URL từ upload |
| `contracts` | `List<Contract>` | CascadeType.ALL |
| `deleted` / `deletedAt` / `deletedBy` | soft delete | cột `is_deleted` |

### Contract

| Field | Type | Ghi chú |
|---|---|---|
| `room` | `Room` | ManyToOne |
| `tenant` | `Tenant` | ManyToOne |
| `startDate` / `endDate` | LocalDate | tối thiểu 6 tháng |
| `monthlyRent` | BigDecimal | |
| `numberOfPeople` | Integer | dùng để tính `serviceFee` khi tạo hóa đơn |
| `status` | Enum | `ACTIVE` / `TERMINATED` / `EXPIRED` |
| `deleted` / `deletedAt` / `deletedBy` | soft delete | |

### Invoice

| Field | Type | Ghi chú |
|---|---|---|
| `contract` | `Contract` | ManyToOne |
| `billingMonth` | LocalDate | **luôn là ngày 1 của tháng** |
| `roomFee` | BigDecimal | |
| `electricOld/New/Used/UnitPrice/Fee` | Int/BigDecimal | |
| `waterOld/New/Used/UnitPrice/Fee` | Int/BigDecimal | |
| `servicePeople` / `serviceUnitPrice` / `serviceFee` | Int/BigDecimal | số người lấy từ `contract.numberOfPeople` |
| `networkUnitPrice` / `networkFee` | BigDecimal | |
| `totalAmount` | BigDecimal | |
| `status` | Enum | `UNPAID` / `OVERDUE` / `PAID` |
| `dueDate` | LocalDate | mặc định = cuối tháng billing |
| `paidAt` | LocalDateTime | |
| `paymentConfirmedBy` | String | username |
| `notificationSent` | boolean | |
| `deleted` / `deletedAt` / `deletedBy` | soft delete | |

### Tenant

| Field | Type | Ghi chú |
|---|---|---|
| `fullName` | String | |
| `phone` | String | unique (soft-delete aware) |
| `email` | String | |
| `idCardNumber` | String | unique (soft-delete aware) |
| `deleted` / `deletedAt` / `deletedBy` | soft delete | |

---

## 4. Luồng xác thực

1. `POST /api/v1/auth/login` hoặc `POST /api/v1/auth/register`
2. Backend trả JWT; FE lưu `token`, `username`, `role` vào `localStorage` qua `authStore` (Zustand).
3. `App.tsx` dùng `PrivateRoute` chặn tất cả route nếu `!isAuthenticated`.
4. `axiosClient` tự gắn `Authorization: Bearer <token>` mọi request.
5. Backend `SecurityConfig`: public `/api/v1/auth/**` và `/uploads/**`; còn lại yêu cầu JWT.
6. `401` từ backend → FE xóa `localStorage` + redirect `/login`.
7. `GET /api/v1/auth/me` — lấy profile user hiện tại (đọc username từ JWT).
8. `PATCH /api/v1/auth/change-password` — đổi mật khẩu (kiểm tra mật khẩu cũ trước).

**Lưu ý:** Chưa phân quyền theo role (ADMIN/USER) — mọi user authenticated đều dùng được mọi endpoint.

---

## 5. Dashboard

**Route:** `/` → `DashboardPage.tsx`

### Header

- Tiêu đề: `Xin chào, <username>!` — lấy từ `useAuthStore(s => s.username)`
- Badge phải: `<CalendarDays /> Tháng {M}/{YYYY}` — styled pill màu primary (bg-primary-50, border-primary-100)
- Không có quick action buttons.

### FE gọi song song 4 API

```
GET /api/v1/properties
GET /api/v1/invoices
GET /api/v1/contracts
GET /api/v1/rooms
```

### Tính toán ở FE (không có dashboard endpoint)

| Chỉ số | Cách tính |
|---|---|
| Tỷ lệ lấp đầy | `rooms.filter(OCCUPIED).length / rooms.length` |
| Hợp đồng sắp hết hạn | contract ACTIVE, `endDate` trong 30 ngày |
| Đã thu tháng này | invoice PAID có `billingMonth` bắt đầu bằng `YYYY-MM` hiện tại |
| % so tháng trước | so sánh `paidThisMonth` vs `paidLastMonth` |
| Hóa đơn chưa tạo tháng này | contract ACTIVE không có invoice trong tháng hiện tại |

### Biểu đồ doanh thu 6 tháng

- Dùng Recharts `BarChart` + `Bar` với `shape` prop (custom SVG rect).
- Tháng hiện tại: fill `#059669` (xanh đậm); các tháng còn lại: `#a7f3d0` (xanh nhạt).
- **Không dùng `<Cell>`** (deprecated) — màu được truyền qua `shape` prop đọc `entry.current`.

---

## 6. Khu trọ (Property)

**Route:** `/properties` → `PropertyPage.tsx`
**Backend:** `PropertyController` → `PropertyServiceImpl` → `PropertyRepository`

### API endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/properties` | Danh sách tất cả (chưa xóa) |
| POST | `/api/v1/properties` | Tạo mới |
| PUT | `/api/v1/properties/{id}` | Sửa |
| DELETE | `/api/v1/properties/{id}` | Soft delete |

### Business rules

- Tên khu trọ phải unique theo owner (`existsByNameAndOwnerIdAndDeletedFalse`).
- Khi update: check trùng tên loại trừ chính nó (`AndIdNotAndDeletedFalse`).
- **Xóa bị chặn nếu:**
  1. Có phòng đang `OCCUPIED` (`existsByPropertyIdAndStatusAndDeletedFalse`).
  2. Có hóa đơn `PAID` bất kỳ liên quan đến khu trọ (`existsPaidInvoiceByPropertyId`).
- Xóa là **soft delete**: set `deleted=true`, `deletedAt`, `deletedBy`.
- `totalRooms` trong response = số phòng chưa bị soft delete (`rooms.stream().filter(!deleted).count()`).

### Lưu ý FE

- `ownerId: 1` đang hard-code khi tạo/sửa — chưa lấy theo user đang đăng nhập.

---

## 7. Phòng (Room)

**Route:** `/rooms` → `RoomPage.tsx`
**Backend:** `RoomController` → `RoomServiceImpl` → `RoomRepository`

### API endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/rooms` | Tất cả phòng (findAllWithProperty) |
| GET | `/api/v1/rooms/{id}` | Theo id |
| GET | `/api/v1/rooms/property/{propertyId}` | Theo khu trọ (+ filter status) |
| POST | `/api/v1/rooms` | Tạo mới |
| PUT | `/api/v1/rooms/{id}` | Sửa |
| PATCH | `/api/v1/rooms/{id}/status` | Đổi trạng thái |
| DELETE | `/api/v1/rooms/{id}` | Soft delete |
| POST | `/api/v1/uploads/rooms` | Upload ảnh |

### Business rules

- `roomNumber` phải unique trong cùng `propertyId`.
  - Khi **create**: `existsByRoomNumberAndPropertyIdAndDeletedFalse`.
  - Khi **update**: `existsByRoomNumberAndPropertyIdAndIdNotAndDeletedFalse`.
- `PATCH status` chỉ cho phép nếu phòng không phải `OCCUPIED` (FE enforce, backend không chặn cứng).
- **Xóa bị chặn nếu:**
  - Có hóa đơn `PAID` liên quan đến phòng (`existsByContractRoomIdAndStatusAndDeletedFalse`).
- Xóa là **soft delete**.

### Upload ảnh

- `POST /api/v1/uploads/rooms` → `FileStorageServiceImpl#storeRoomImage`
- Validate: `image/*`, extension `.jpg/.jpeg/.png/.webp/.gif`
- Lưu vào `uploads/rooms/<uuid>.<ext>`; trả URL tuyệt đối `/uploads/rooms/...`
- `StaticResourceConfig` map `/uploads/**` ra thư mục thật trên disk.

---

## 8. Khách thuê (Tenant)

**Route:** `/tenants` → `TenantPage.tsx`
**Backend:** `TenantController` → `TenantServiceImpl` → `TenantRepository`

### API endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/tenants` | Danh sách tất cả |
| POST | `/api/v1/tenants` | Tạo mới |
| PUT | `/api/v1/tenants/{id}` | Sửa |
| DELETE | `/api/v1/tenants/{id}` | Soft delete |

### Business rules

- **Create:**
  - `phone` phải unique (chỉ check bản ghi chưa xóa — `existsByPhoneAndDeletedFalse`).
  - `idCardNumber` nếu có phải unique (chỉ check chưa xóa — `existsByIdCardNumberAndDeletedFalse`).
- **Update:**
  - Check phone bị tenant khác dùng chưa.
  - Check CCCD bị tenant khác dùng chưa (`findByIdCardNumberAndDeletedFalse` → so sánh id).
- **Lưu ý lịch sử:** Các tenant đã soft-delete không tính vào check uniqueness → tránh chặn nhầm khi thêm lại cùng số điện thoại/CCCD sau khi xóa.

### FE

- Search là filter client-side theo `fullName` + `phone` — không có API search riêng.
- Từ trang hợp đồng có thể điều hướng sang `/tenants?tenantId=<id>` để highlight đúng khách.
- FE gọi thêm `contractApi.getAll()` để group hợp đồng theo khách thuê.

---

## 9. Hợp đồng (Contract)

**Route:** `/contracts` → `ContractPage.tsx`
**Backend:** `ContractController` → `ContractServiceImpl` → `ContractRepository`

### API endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/contracts` | Tất cả (chưa xóa) |
| GET | `/api/v1/contracts/{id}` | Theo id |
| GET | `/api/v1/contracts/room/{roomId}` | Theo phòng |
| GET | `/api/v1/contracts/tenant/{tenantId}` | Theo khách thuê |
| POST | `/api/v1/contracts` | Tạo mới |
| PUT | `/api/v1/contracts/{id}` | Sửa |
| PATCH | `/api/v1/contracts/{id}/terminate` | Chấm dứt |
| DELETE | `/api/v1/contracts/{id}` | Soft delete |

### Business rules — CREATE

1. `startDate` không được ở quá khứ.
2. `endDate` phải sau `startDate`.
3. Thời hạn tối thiểu **6 tháng** (`endDate >= startDate + 6 months`).
4. Phòng phải `AVAILABLE`.
5. Phòng không được có contract `ACTIVE` khác.
6. Khi tạo xong: `room.status → OCCUPIED`.

### Business rules — UPDATE

1. Không sửa được contract `TERMINATED`.
2. `endDate` mới phải sau `startDate` gốc.
3. `endDate` mới phải đảm bảo tối thiểu **6 tháng** tính từ `startDate` gốc.
4. `monthlyRent` phải > 0.
5. `numberOfPeople` phải ≥ 1.

### Business rules — TERMINATE

1. Chỉ terminate được contract đang `ACTIVE`.
2. **Bị chặn nếu còn nợ** (`sumOutstandingByContractId > 0`) — bao gồm cả UNPAID và OVERDUE.
3. Khi terminate: `contract.status → TERMINATED`, `room.status → AVAILABLE`.

### Business rules — DELETE (soft delete)

Delete bị chặn nếu bất kỳ điều kiện nào sau đây đúng:

| Điều kiện | Lỗi trả về |
|---|---|
| Contract đang ACTIVE (đã bắt đầu, chưa kết thúc) | "Không thể xóa: Hợp đồng đang có hiệu lực" |
| Đã có invoice của kỳ billing tháng hiện tại | "Không thể xóa: Hợp đồng đang trong kỳ thanh toán hiện tại" |
| Còn nợ chưa thanh toán | "Không thể xóa: Khách thuê còn nợ Xđ chưa thanh toán" |
| Đã có invoice PAID (lịch sử thu tiền) | "Không thể xóa: Hợp đồng đã có lịch sử thu tiền, cần lưu trữ để đối soát tài chính" |
| Trạng thái không thỏa rule | "Không thể xóa: Chỉ cho phép xóa hợp đồng đã chấm dứt, hết hạn hoặc chưa đến ngày bắt đầu" |

Khi xóa được: `deleted=true`, `deletedAt`, `deletedBy`. Nếu phòng đang `OCCUPIED` thì trả về `AVAILABLE`.

### Tự động hết hạn (Cron)

- Cron `0 5 0 * * *` (00:05 Asia/Ho_Chi_Minh): tìm tất cả contract `ACTIVE` có `endDate < today`, chuyển → `EXPIRED`, trả phòng về `AVAILABLE`.
- Xem chi tiết ở [mục 12](#12-cron-jobs--tự-động-hóa).

---

## 10. Hóa đơn (Invoice)

**Route:** `/invoices` → `InvoicePage.tsx`
**Backend:** `InvoiceController` → `InvoiceServiceImpl` → `InvoiceRepository`

### API endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/invoices` | Tất cả (chưa xóa) |
| GET | `/api/v1/invoices/{id}` | Theo id |
| GET | `/api/v1/invoices/contract/{contractId}` | Theo hợp đồng |
| POST | `/api/v1/invoices` | Tạo mới |
| PATCH | `/api/v1/invoices/{id}/mark-paid` | Đánh dấu đã thu |
| DELETE | `/api/v1/invoices/{id}` | Soft delete |
| GET | `/api/v1/invoices/{id}/pdf` | Tải PDF |

### Business rules — CREATE

1. `billingMonth` **luôn được normalize về ngày 1** (`withDayOfMonth(1)`) ngay khi vào service.
2. Contract phải tồn tại và đang `ACTIVE`.
3. **`billingMonth` phải nằm trong khoảng** `[contract.startDate, contract.endDate]` (đều normalize về ngày 1).
4. Không tạo trùng hóa đơn cùng `contractId + billingMonth`.
5. `electricNew >= electricOld` (lấy từ hóa đơn tháng trước của cùng contract).
6. `waterNew >= waterOld`.
7. `servicePeople` lấy tự động từ `contract.numberOfPeople` — không nhận từ request.
8. `dueDate` mặc định = cuối tháng `billingMonth`.

**Request payload từ FE:** `contractId`, `billingMonth`, `electricNew`, `waterNew`.

### Business rules — DELETE

- Bị chặn nếu: đã `PAID`, `notificationSent=true`, hoặc đang `OVERDUE`.
- Chỉ xóa được invoice `UNPAID` chưa gửi thông báo.

### Tự động quá hạn (Cron)

- Cron `0 10 0 * * *` (00:10 Asia/Ho_Chi_Minh): `UNPAID` quá `dueDate` → `OVERDUE`.

### FE tự điền chỉ số cũ

FE duyệt tập invoice đã tải để tìm hóa đơn tháng trước của cùng phòng, set default vào form.
Không có API riêng cho "chỉ số cũ".

---

## 11. AI Assistant

**Route:** `/ai` → `AiChatPage.tsx`
**Backend:** `AiController` → `AiServiceImpl` → `AiContextServiceImpl`

### Luồng chat

1. `POST /api/v1/ai/chat` với `{ message: "..." }`
2. `AiServiceImpl#tryHandleDirectAction` — nhận diện keyword hành động trực tiếp:
   - "đánh dấu đã thu / đã thanh toán / xác nhận thanh toán" → `InvoiceService#markAsPaid` cho từng `#ID`
   - "chấm dứt hợp đồng / kết thúc hợp đồng" → `ContractService#terminate` cho `#ID` đầu tiên
3. Nếu không phải direct action → `AiContextServiceImpl#buildContext()` build context từ DB (cache 2 phút).
4. Ghép `system prompt + context + câu hỏi` → Spring AI → Groq `llama-3.3-70b-versatile`.
5. Trả `AiChatResponse { question, answer }`.

### Cấu hình AI

```properties
# application-groq.properties
spring.ai.openai.chat.options.model=llama-3.3-70b-versatile
spring.ai.openai.chat.options.temperature=0.3
spring.ai.retry.max-attempts=3
spring.ai.retry.backoff.initial-interval=3000
spring.ai.retry.backoff.max-interval=10000
spring.ai.retry.backoff.multiplier=2
spring.ai.retry.on-http-codes=429
```

Nếu không có `ChatClient.Builder` (chạy thiếu AI profile), trả fallback message hướng dẫn.

### Context sections (13 sections)

| Section | Nội dung |
|---|---|
| Khu trọ | Tên, địa chỉ, số phòng theo trạng thái |
| Tất cả phòng | Trạng thái, giá, diện tích, khách đang ở |
| Khách thuê | Họ tên, SĐT, email, CCCD, hợp đồng hiện tại |
| HĐ đang hiệu lực | Đầy đủ, cảnh báo `[SAP HET HAN]` ≤30 ngày, `[GAN HET HAN]` ≤60 ngày |
| HĐ đã kết thúc | 10 HĐ gần nhất (TERMINATED/EXPIRED) |
| Hóa đơn UNPAID | Chi tiết + hạn thanh toán |
| Hóa đơn OVERDUE | Chi tiết + số ngày quá hạn + SĐT khách |
| Doanh thu 12 tháng | Theo tháng + % ±so tháng trước + tóm tắt theo quý |
| Phân tích phòng trống | Ngày trống, lý do, cảnh báo >30/60/90 ngày, doanh thu bị mất |
| Hành vi thanh toán | Khách OVERDUE + lịch sử trễ (số lần, TB ngày, max ngày) |
| Hóa đơn chưa tạo | HĐ ACTIVE chưa có invoice tháng hiện tại |
| Hiệu suất khu trọ | Tỷ lệ lấp đầy, doanh thu tháng + % vs tháng trước |
| Thống kê tổng quan | Tỷ lệ lấp đầy, tổng nợ, đã thu tháng này |

### Sidebar gợi ý (2×2 tab)

| Tab | Icon | Gợi ý |
|---|---|---|
| Doanh thu | TrendingUp | So sánh tháng, doanh thu theo quý, tổng quan tài chính |
| Phân tích | BarChart2 | Phòng trống lâu, khách trễ hạn, hiệu suất khu trọ |
| Cảnh báo | Bell | HĐ sắp hết hạn, hóa đơn chưa tạo, tổng tiền nợ |
| Hành động | Wrench | Đánh dấu đã thu, chấm dứt hợp đồng |

---

## 12. Cron jobs & tự động hóa

| Cron | Thời gian | Class | Hành động |
|---|---|---|---|
| `0 5 0 * * *` | 00:05 Asia/HCM | `ContractServiceImpl#expireContractsDaily` | Contract ACTIVE có `endDate < today` → `EXPIRED`; room → `AVAILABLE` |
| `0 10 0 * * *` | 00:10 Asia/HCM | `InvoiceServiceImpl#updateOverdueInvoicesDaily` | Invoice UNPAID có `dueDate < today` → `OVERDUE` |

`@EnableScheduling` đặt trên `SmartrentApplication`. Timezone `Asia/Ho_Chi_Minh` khai báo rõ trong `@Scheduled`.

---

## 13. Soft delete — quy ước toàn hệ thống

### Entities có soft delete

| Entity | Cột DB | Default |
|---|---|---|
| `Property` | `is_deleted`, `deleted_at`, `deleted_by` | `false` |
| `Room` | `is_deleted`, `deleted_at`, `deleted_by` | `false` |
| `Contract` | `deleted`, `deleted_at`, `deleted_by` | `false` |
| `Invoice` | `deleted`, `deleted_at`, `deleted_by` | `false` |
| `Tenant` | `deleted`, `deleted_at`, `deleted_by` | `false` |

### Repository convention

- Mọi query business đều dùng method có đuôi `AndDeletedFalse`.
- Ví dụ: `findByIdAndDeletedFalse`, `existsByPhoneAndDeletedFalse`, `findByDeletedFalse`.
- Query JPQL có `WHERE ... AND c.deleted = false` (hoặc `r.deleted = false`).
- **Không bao giờ gọi `findAll()` hay `findById()` gốc cho business logic** — sẽ trả về cả bản ghi đã xóa.

### Soft delete thực hiện

```java
entity.setDeleted(true);
entity.setDeletedAt(LocalDateTime.now());
entity.setDeletedBy(getCurrentUsername()); // từ SecurityContextHolder
repository.save(entity);
```

### DB migration cần thiết

Khi deploy lần đầu (hoặc reset DB prod), cần chạy:
```sql
ALTER TABLE properties ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE properties ADD COLUMN deleted_by VARCHAR(100) NULL;

ALTER TABLE rooms ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE rooms ADD COLUMN deleted_by VARCHAR(100) NULL;
```
H2 (dev) tự tạo cột khi restart. MySQL/prod cần migration tay.

---

## 14. Business rules tổng hợp

### Luồng trạng thái Room

```
AVAILABLE ──[tạo HĐ]──▶ OCCUPIED ──[terminate/expire HĐ]──▶ AVAILABLE
AVAILABLE ──[admin]───▶ MAINTENANCE ──[admin]──────────────▶ AVAILABLE
```

### Luồng trạng thái Contract

```
ACTIVE ──[endDate < today, cron 00:05]──▶ EXPIRED
ACTIVE ──[admin terminate, không còn nợ]──▶ TERMINATED
```

### Luồng trạng thái Invoice

```
UNPAID ──[dueDate < today, cron 00:10]──▶ OVERDUE
UNPAID ──[mark-paid]──▶ PAID
OVERDUE ──[mark-paid]──▶ PAID
```

### Ràng buộc xóa theo tầng

```
Property bị chặn xóa nếu:
  ├── Có Room OCCUPIED
  └── Có Invoice PAID bất kỳ

Room bị chặn xóa nếu:
  └── Có Invoice PAID bất kỳ

Contract bị chặn xóa nếu:
  ├── Đang ACTIVE
  ├── Có invoice kỳ hiện tại
  ├── Còn nợ (UNPAID/OVERDUE)
  └── Đã có invoice PAID (lịch sử tài chính)

Invoice bị chặn xóa nếu:
  ├── Đã PAID
  ├── notificationSent = true
  └── Đang OVERDUE
```

---

## 15. Vấn đề còn tồn tại

| Vị trí | Vấn đề | Mức độ |
|---|---|---|
| `PropertyPage.tsx` | `ownerId: 1` hardcode, chưa lấy từ user đang đăng nhập | Trung bình |
| `SecurityConfig.java` | Không phân quyền theo role (ADMIN/USER), chỉ check `authenticated` | Trung bình |
| `ContractPage.tsx` | Gọi `roomApi.getById(roomId)` cho từng HĐ để lấy tên khu trọ — N+1 ở FE | Nhỏ |
| `Payment` entity | Tồn tại nhưng chưa có `PaymentService` / controller đầy đủ | Không ảnh hưởng |
| DB migration | `is_deleted` trên Property/Room cần script SQL cho MySQL prod | Cần làm trước deploy |
| CORS | Chỉ cấu hình trong `SecurityConfig`; `AppConfig` không còn bean CORS | Ổn với localhost |

---

## 16. Lịch sử nâng cấp

### 2026-05-22 — AI Assistant v1

- `AiContextServiceImpl` rewrite: 4 section → 13 section, tối ưu JOIN FETCH tránh N+1.
- `AiChatPage.tsx`: sidebar list → tab 2×2 gợi ý.

### 2026-05-22 — AI Assistant v2

- Đổi model Groq: `openai/gpt-oss-20b` → `llama-3.3-70b-versatile` (fix 429 rate limit).
- Thêm retry 3 lần backoff 3s→10s cho HTTP 429.
- Thêm cache volatile 2 phút cho context (tránh đọc DB liên tiếp).
- Tab "Tạo nhanh" → tab "Hành động" (đánh dấu đã thu, chấm dứt HĐ qua chat).

### 2026-05-22 — Hợp đồng numberOfPeople

- `Contract` thêm field `numberOfPeople`.
- `InvoiceServiceImpl`: `servicePeople` lấy từ `contract.numberOfPeople` thay vì từ request.
- `InvoicePage.tsx`: xóa input "Số người", thay bằng read-only từ hợp đồng đã chọn.

### 2026-06-01/02 — Business logic fixes & UI

#### Backend fixes

1. **Duplicate CORS bean**: Xóa `corsConfigurationSource` khỏi `AppConfig.java` (giữ lại ở `SecurityConfig.java`). Fix `BeanDefinitionOverrideException` khi startup.

2. **roomNumber duplicate check on update**: `RoomServiceImpl#update` thêm kiểm tra `existsByRoomNumberAndPropertyIdAndIdNotAndDeletedFalse`.

3. **Soft delete cho Property & Room**: Thêm 3 field (`deleted`, `deletedAt`, `deletedBy`) vào cả hai entity. Cập nhật toàn bộ repository dùng `AndDeletedFalse`. Service `delete()` chuyển từ hard delete → soft delete với guard chặn xóa.

4. **Contract EXPIRED tự động (Cron)**: Thêm `ContractServiceImpl#expireContractsDaily` (`@Scheduled 00:05`). Thêm `ContractRepository#findActiveContractsExpiredBefore`.

5. **Chặn terminate khi còn nợ**: `ContractServiceImpl#terminate` check `sumOutstandingByContractId > 0` trước khi cho terminate.

6. **Chặn update CCCD trùng**: `TenantServiceImpl#update` thêm kiểm tra CCCD uniqueness qua `findByIdCardNumberAndDeletedFalse`.

7. **Uniqueness check tenant không tính soft-deleted**: `create()` dùng `existsByPhoneAndDeletedFalse`, `existsByIdCardNumberAndDeletedFalse`.

8. **billingMonth normalize**: `InvoiceServiceImpl#create` gọi `withDayOfMonth(1)` ngay đầu hàm.

9. **Contract 6-month minimum on update**: `ContractServiceImpl#update` thêm check `endDate < startDate + 6 months`.

10. **Invoice ngoài khoảng hợp đồng**: `InvoiceServiceImpl#create` kiểm tra `billingMonth` trong `[startDate, endDate]` (đều normalize về ngày 1).

11. **Chặn xóa Property/Room có lịch sử tài chính**: `InvoiceRepository` thêm `existsPaidInvoiceByPropertyId`, `existsByContractRoomIdAndStatusAndDeletedFalse`. Service `delete()` dùng hai guard này.

12. **Chặn xóa Contract có lịch sử thu tiền**: `ContractServiceImpl#getDeleteBlockedReason` thêm check `existsByContractIdAndStatusAndDeletedFalse(PAID)`.

#### Frontend fixes & UI

13. **Favicon**: Thay `favicon.svg` bằng logo chữ "SR" (white bold trên nền #2563eb, rx=10).
14. **Tab title**: `index.html` → `<title>SmartRent</title>`.
15. **Dashboard header**: Xóa 3 quick action buttons (Hóa đơn, Hợp đồng, Hỏi AI).
16. **Dashboard greeting**: Thêm `Xin chào, <username>!` lấy từ `useAuthStore`.
17. **Dashboard month badge**: "Tổng quan tháng X/YYYY" → styled pill với `<CalendarDays />` icon.
18. **Recharts Cell deprecated**: Thay `<Cell>` bằng `shape` prop custom SVG renderer trên `<Bar>`.
