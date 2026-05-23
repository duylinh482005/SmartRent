# TTCS

## Mục tiêu tài liệu

Tài liệu này ghi lại luồng hoạt động từ giao diện admin xuống backend cho các chức năng:

- Dashboard
- Hồ sơ cá nhân
- Khu trọ
- Phòng
- Khách thuê
- Hợp đồng
- Hóa đơn
- AI Assistant

Ngoài ra có thêm phần ghi nhận các file/thư mục có dấu hiệu là file rác, file debug, file sinh ra khi build hoặc file có khả năng không còn được dùng. Chưa xóa file nào.

## Cấu trúc repo

- `smartrent-fe`: frontend React + Vite + TanStack Query + Zustand
- `smartrent/smartrent`: backend Spring Boot
- `README.md`: tài liệu tổng hợp ở root

## Luồng chung từ admin UI xuống backend

1. Admin đăng nhập ở `smartrent-fe/src/pages/LoginPage.tsx`.
2. FE gọi `authApi` -> `POST /api/v1/auth/login` hoặc `POST /api/v1/auth/register`.
3. Backend trả JWT; FE lưu `token`, `username`, `role` vào `localStorage` qua `authStore`.
4. `App.tsx` dùng `PrivateRoute` để chặn toàn bộ route admin nếu chưa có token.
5. Mọi API business từ FE đều đi qua `axiosClient` với base URL `http://localhost:8080/api/v1`.
6. `axiosClient` tự gắn header `Authorization: Bearer <token>`.
7. Backend `SecurityConfig` cho phép public với `/api/v1/auth/**` và `/uploads/**`, còn lại phải xác thực JWT.
8. Nếu backend trả lỗi:
   - FE hiển thị toast qua `axiosClient`.
   - `401` sẽ tự xóa localStorage và đẩy người dùng về `/login`.
   - Backend gom lỗi validate/runtime qua `GlobalExceptionHandler`.

### Bổ sung: Hồ sơ người đang đăng nhập

- Từ block user ở cuối `Sidebar`, admin có thể vào `/profile`.
- FE gọi `GET /api/v1/auth/me` để lấy thông tin tài khoản hiện tại.
- FE gọi `PATCH /api/v1/auth/change-password` để đổi mật khẩu.
- Backend đọc username từ JWT hiện tại, sau đó:
  - tìm đúng user đang đăng nhập
  - trả profile chi tiết
  - kiểm tra mật khẩu hiện tại trước khi đổi mật khẩu mới

## 1. Dashboard

### Route UI

- Sidebar -> `/`
- Component chính: `smartrent-fe/src/pages/DashboardPage.tsx`

### FE gọi gì

Dashboard không có API tổng hợp riêng. FE gọi song song:

- `propertyApi.getAll()` -> `GET /api/v1/properties`
- `invoiceApi.getAll()` -> `GET /api/v1/invoices`
- `contractApi.getAll()` -> `GET /api/v1/contracts`

### FE xử lý dữ liệu

Sau khi lấy dữ liệu, `DashboardPage` tự tính trên client:

- Tổng khu trọ = `properties.length`
- Tổng phòng = cộng `property.totalRooms`
- Hợp đồng đang hiệu lực = filter `contract.status === ACTIVE`
- Hóa đơn chưa thu = filter `invoice.status === UNPAID || OVERDUE`
- Danh sách hợp đồng sắp hết hạn = contract `ACTIVE` và `endDate` trong 30 ngày tới
- Khối “Đã thu” đang cộng toàn bộ hóa đơn `PAID`

### Backend đi qua đâu

- `PropertyController` -> `PropertyServiceImpl#getAll` -> `PropertyRepository.findAll`
- `InvoiceController` -> `InvoiceServiceImpl#getAll` -> `InvoiceRepository.findByDeletedFalse`
- `ContractController` -> `ContractServiceImpl#getAll` -> `ContractRepository.findByDeletedFalse`

### Ghi chú

- Không có `dashboard endpoint`; thống kê đang ghép ở FE.
- Biến `paidThisMonth` ở FE tên là “tháng này” nhưng thực tế chưa lọc theo tháng, chỉ lọc theo trạng thái `PAID`.

## 2. Khu trọ

### Route UI

- Sidebar -> `/properties`
- Component chính: `smartrent-fe/src/pages/PropertyPage.tsx`

### Các luồng chính

#### Xem danh sách khu trọ

- FE mở trang sẽ gọi `propertyApi.getAll()` -> `GET /api/v1/properties`
- Backend: `PropertyController#getAll` -> `PropertyServiceImpl#getAll` -> `PropertyRepository.findAll`
- Response trả về `PropertyResponse`, trong đó `totalRooms` được tính từ `p.getRooms().size()`

#### Tạo khu trọ

- FE submit modal -> `propertyApi.create(payload)` -> `POST /api/v1/properties`
- `payload` gồm `name`, `address`, `description`, `ownerId`
- Backend:
  - `PropertyController#create`
  - `PropertyServiceImpl#create`
  - `UserRepository.findById(ownerId)` để tìm chủ
  - kiểm tra trùng tên theo owner: `existsByNameAndOwnerId`
  - lưu `PropertyRepository.save`

#### Sửa khu trọ

- FE -> `PUT /api/v1/properties/{id}`
- Backend:
  - tìm property theo id
  - cập nhật `name`, `address`, `description`
  - `PropertyRepository.save`

#### Xóa khu trọ

- FE -> `DELETE /api/v1/properties/{id}`
- Backend:
  - tìm property
  - `PropertyRepository.delete`

### Ghi chú

- FE đang hard-code `ownerId: 1` khi tạo/sửa khu trọ. Đây là ràng buộc ở frontend, chưa lấy theo user đăng nhập hiện tại.

## 3. Phòng

### Route UI

- Sidebar -> `/rooms`
- Component chính: `smartrent-fe/src/pages/RoomPage.tsx`

### Các luồng chính

#### Tải danh sách khu trọ để lọc/chọn

- FE gọi `propertyApi.getAll()` -> `GET /api/v1/properties`
- Dùng cho dropdown chọn khu trọ trước khi xem danh sách phòng

#### Xem danh sách phòng theo khu trọ

- FE chỉ gọi khi đã chọn khu trọ
- `roomApi.getByProperty(propertyId, status?)` -> `GET /api/v1/rooms/property/{propertyId}?status=...`
- Backend:
  - `RoomController#getByProperty`
  - nếu có `status` -> `RoomServiceImpl#getByPropertyAndStatus`
  - nếu không có `status` -> `RoomServiceImpl#getByProperty`
  - repository đọc theo `propertyId` và tùy chọn trạng thái

#### Upload ảnh phòng

- FE chọn file ảnh -> `roomApi.uploadRoomImage(file)` -> `POST /api/v1/uploads/rooms`
- Backend:
  - `UploadController#uploadRoomImage`
  - `FileStorageServiceImpl#storeRoomImage`
  - validate `image/*`, validate extension `.jpg/.jpeg/.png/.webp/.gif`
  - lưu vào `uploads/rooms/<uuid>.<ext>`
  - trả URL tuyệt đối `/uploads/rooms/...`
- `StaticResourceConfig` map `/uploads/**` ra thư mục upload thật trên máy

#### Tạo phòng

- FE submit modal -> `POST /api/v1/rooms`
- Payload: `roomNumber`, `price`, `area`, `description`, `imageUrl`, `propertyId`
- Backend:
  - `RoomController#create`
  - `RoomServiceImpl#create`
  - tìm `Property`
  - check trùng số phòng trong cùng khu trọ bằng `existsByRoomNumberAndPropertyId`
  - tạo `Room` mới, trạng thái mặc định `AVAILABLE`
  - `RoomRepository.save`

#### Sửa phòng

- FE -> `PUT /api/v1/rooms/{id}`
- Backend:
  - `RoomServiceImpl#update`
  - cập nhật `roomNumber`, `price`, `area`, `description`, `imageUrl`

#### Đổi trạng thái phòng

- Chỉ có khi sửa phòng
- FE chỉ gọi `PATCH /api/v1/rooms/{id}/status?status=...` nếu:
  - đang edit
  - trạng thái mới khác trạng thái cũ
  - phòng hiện tại không phải `OCCUPIED`
- Backend: `RoomServiceImpl#updateStatus`

#### Xóa phòng

- FE -> `DELETE /api/v1/rooms/{id}`
- Backend: `RoomServiceImpl#delete` -> `RoomRepository.delete`

### Ghi chú

- FE không cho đổi phòng đang `OCCUPIED` sang `MAINTENANCE`.
- Backend `update` phòng không tự kiểm tra trùng `roomNumber` khi sửa; kiểm tra trùng hiện mới nằm ở luồng create.

## 4. Khách thuê

### Route UI

- Sidebar -> `/tenants`
- Component chính: `smartrent-fe/src/pages/TenantPage.tsx`

### Các luồng chính

#### Xem danh sách khách thuê

- FE gọi `tenantApi.getAll()` -> `GET /api/v1/tenants`
- Backend:
  - `TenantController#getAll`
  - `TenantServiceImpl#getAll`
  - `TenantRepository.findAll`

#### Ghép danh sách hợp đồng theo từng khách thuê

- Cùng lúc FE gọi thêm `contractApi.getAll()` -> `GET /api/v1/contracts`
- FE tự group `contractsByTenant` để hiển thị hợp đồng nào đang gắn với từng khách thuê

#### Tạo khách thuê

- FE submit modal -> `POST /api/v1/tenants`
- Backend:
  - `TenantController#create`
  - `TenantServiceImpl#create`
  - check trùng `phone`
  - nếu có CCCD thì check trùng `idCardNumber`
  - lưu `TenantRepository.save`

#### Sửa khách thuê

- FE -> `PUT /api/v1/tenants/{id}`
- Backend:
  - `TenantServiceImpl#update`
  - tìm tenant theo id
  - check `phone` có bị dùng bởi tenant khác không
  - cập nhật `fullName`, `phone`, `email`, `idCardNumber`

#### Xóa khách thuê

- FE -> `DELETE /api/v1/tenants/{id}`
- Backend: `TenantServiceImpl#delete` -> `TenantRepository.delete`

### Ghi chú

- Ô search ở trang khách thuê là filter thuần FE theo `fullName` và `phone`, không có API search riêng.
- Từ trang hợp đồng có thể điều hướng sang `/tenants?tenantId=<id>` để highlight đúng khách thuê.

## 5. Hợp đồng

### Route UI

- Sidebar -> `/contracts`
- Component chính: `smartrent-fe/src/pages/ContractPage.tsx`

### Các luồng chính

#### Xem danh sách hợp đồng

- FE gọi `contractApi.getAll()` -> `GET /api/v1/contracts`
- Backend:
  - `ContractController#getAll`
  - `ContractServiceImpl#getAll`
  - `ContractRepository.findByDeletedFalse`

#### Bổ sung tên khu trọ cho từng hợp đồng

- Sau khi có danh sách hợp đồng, FE lấy các `roomId` rồi gọi nhiều request:
  - `roomApi.getById(roomId)` -> `GET /api/v1/rooms/{id}`
- Mục đích: dựng `roomPropertyMap` để hiện tên khu trọ trong bảng hợp đồng
- Đây là bước ghép dữ liệu ở FE, không phải backend trả sẵn cho riêng màn lọc

#### Lấy dữ liệu để tạo hợp đồng

- FE gọi:
  - `propertyApi.getAll()` để chọn khu trọ
  - `roomApi.getByProperty(propertyId, 'AVAILABLE')` để lấy phòng còn trống
  - `tenantApi.getAll()` để chọn khách thuê

#### Tạo nhanh khách thuê ngay trong form hợp đồng

- FE mở modal “Thêm nhanh khách thuê”
- Gọi `tenantApi.create()` -> `POST /api/v1/tenants`
- Nếu thành công:
  - invalidate query `tenants`
  - tự set `tenantId` vừa tạo vào form hợp đồng

#### Tạo hợp đồng

- FE submit -> `POST /api/v1/contracts`
- Backend:
  - `ContractController#create`
  - `ContractServiceImpl#create`
  - validate:
    - `startDate` không ở quá khứ
    - `endDate` phải sau `startDate`
    - thời hạn tối thiểu 6 tháng
  - tìm `Room`, bắt buộc phòng đang `AVAILABLE`
  - check chưa có hợp đồng `ACTIVE` khác cho cùng phòng
  - tìm `Tenant`
  - tạo `Contract` trạng thái `ACTIVE`, lưu thêm `numberOfPeople`
  - đồng thời đổi `Room.status = OCCUPIED`
  - lưu room rồi lưu contract

#### Chấm dứt hợp đồng

- FE -> `PATCH /api/v1/contracts/{id}/terminate`
- Backend:
  - chỉ cho phép nếu contract đang `ACTIVE`
  - đổi `Contract.status = TERMINATED`
  - đổi `Room.status = AVAILABLE`

#### Xóa hợp đồng

- FE -> `DELETE /api/v1/contracts/{id}`
- Backend thực hiện soft delete, không xóa cứng:
  - `deleted = true`
  - `deletedAt`
  - `deletedBy`
- Trước khi soft delete, backend chặn nếu:
  - hợp đồng đang có hiệu lực
  - đã có hóa đơn kỳ hiện tại
  - còn công nợ chưa thanh toán
  - đã có lịch sử payment
  - đã phát sinh hóa đơn
  - trạng thái không thỏa rule cho phép xóa
- Nếu phòng đang `OCCUPIED`, backend trả phòng về `AVAILABLE`

### Ghi chú

- Bộ lọc theo tên khách thuê, phòng, ngày hết hạn, trạng thái đang chạy ở FE.
- FE có fuzzy search theo tên khách thuê, không có endpoint search riêng.

## 6. Hóa đơn

### Route UI

- Sidebar -> `/invoices`
- Component chính: `smartrent-fe/src/pages/InvoicePage.tsx`

### Các luồng chính

#### Xem danh sách hóa đơn

- FE gọi `invoiceApi.getAll()` -> `GET /api/v1/invoices`
- Backend:
  - `InvoiceController#getAll`
  - nếu có `status` thì `InvoiceServiceImpl#getByStatus`
  - nếu không có thì `InvoiceServiceImpl#getAll`
  - chỉ lấy invoice chưa bị soft delete

#### Lấy dữ liệu phụ để tạo hóa đơn

- FE gọi thêm:
  - `propertyApi.getAll()`
  - `contractApi.getAll()`
- FE tự lọc các hợp đồng `ACTIVE`, từ đó dựng:
  - danh sách khu trọ quản lý
  - danh sách phòng có hợp đồng hiệu lực
  - danh sách hợp đồng của phòng đã chọn

#### Tự điền chỉ số từ tháng trước

- FE không gọi API riêng cho “chỉ số cũ”.
- FE tự duyệt tập invoice đã tải để tìm:
  - hóa đơn tháng trước của cùng phòng
  - hóa đơn gần nhất trong cùng khu trọ để gợi ý đơn giá điện/nước
- Sau đó set default vào form bằng `react-hook-form`

#### Tạo hóa đơn

- FE submit -> `POST /api/v1/invoices`
- Trước khi gửi, FE chặn:
  - chưa chọn khu trọ/phòng/hợp đồng
  - tạo cho tháng ngoài tập cho phép
  - chỉ số điện/nước cuối < đầu
  - đơn giá điện/nước <= 0
  - trùng hóa đơn cùng tháng thì bật modal xác nhận tạo thêm
- Payload FE gửi chỉ gồm: `contractId`, `billingMonth`, `electricNew`, `waterNew` (không có `servicePeople`)
- Backend:
  - `InvoiceController#create`
  - `InvoiceServiceImpl#create`
  - tìm contract chưa bị xóa
  - contract phải đang `ACTIVE`
  - check trùng `contractId + billingMonth`
  - check lại chỉ số điện/nước
  - lấy `servicePeople` tự động từ `contract.getNumberOfPeople()` (không nhận từ request)
  - tính:
    - `roomFee`
    - `electricFee`
    - `waterFee`
    - `serviceFee = serviceUnitPrice × contract.numberOfPeople`
    - `networkFee`
    - `totalAmount`
  - set `status = UNPAID`
  - set `dueDate` mặc định là cuối tháng billing
  - lưu invoice

#### Đánh dấu đã thanh toán

- FE bấm icon xác nhận -> `PATCH /api/v1/invoices/{id}/mark-paid`
- Backend:
  - chỉ cho phép từ `UNPAID` hoặc `OVERDUE`
  - đổi `status = PAID`
  - set `paidAt = now`
  - set `paymentConfirmedBy = username từ SecurityContext`

#### Tải PDF hóa đơn

- FE -> `GET /api/v1/invoices/{id}/pdf`
- Backend:
  - `InvoiceController#downloadPdf`
  - gọi `InvoiceServiceImpl#getById`
  - gọi `PdfService.generateInvoicePdf(invoice)`
  - trả file PDF với header `attachment`

#### Xóa hóa đơn

- FE trước tiên tự chặn trên UI nếu:
  - hóa đơn đã `PAID`
  - `notificationSent = true`
  - hóa đơn `OVERDUE`
- Nếu qua được FE, request `DELETE /api/v1/invoices/{id}` sẽ vào backend
- Backend vẫn kiểm tra lại và soft delete:
  - `deleted = true`
  - `deletedAt`
  - `deletedBy`

#### Cron chuyển quá hạn

- Backend có job `@Scheduled(cron = "0 10 0 * * *", zone = "Asia/Ho_Chi_Minh")`
- Mỗi ngày lúc `00:10`, mọi invoice `UNPAID` quá `dueDate` sẽ bị chuyển sang `OVERDUE`

### Ghi chú

- Rule “chỉ cho tạo tháng hiện tại hoặc tháng trước” hiện nằm chủ yếu ở FE.
- Backend vẫn có rule chống trùng theo `contractId + billingMonth`, nên kể cả FE bypass thì duplicate theo cùng contract vẫn bị chặn.

## 7. AI Assistant

### Route UI

- Sidebar -> `/ai`
- Component chính: `smartrent-fe/src/pages/AiChatPage.tsx`

### Luồng chat

1. Admin nhập câu hỏi hoặc bấm gợi ý trong sidebar.
2. FE gọi `aiApi.chat(message)` -> `POST /api/v1/ai/chat`.
3. Backend vào `AiController#chat` -> `AiServiceImpl#chat`.
4. `AiServiceImpl` kiểm tra `tryHandleDirectAction`:
   - Nếu câu chứa keyword hành động trực tiếp (đánh dấu đã thu / chấm dứt hợp đồng): gọi service tương ứng, **không qua LLM**, trả kết quả ngay.
   - Nếu không: tiếp tục xuống LLM.
5. Kiểm tra `ChatClient.Builder` có sẵn không (fallback nếu chưa cấu hình AI profile).
6. `AiContextServiceImpl#buildContext()` load toàn bộ dữ liệu từ DB, xây dựng context văn bản.
7. Backend ghép `system prompt + context + câu hỏi` rồi gửi qua Spring AI sang model.
8. Backend trả `AiChatResponse { question, answer }`.
9. FE thay bubble loading `...` bằng câu trả lời thật.

### Hành động trực tiếp qua chat

`AiServiceImpl#tryHandleDirectAction` nhận diện keyword và thực thi ngay, **không tốn token LLM**:

| Keyword nhận diện | Hành động | Service gọi |
|---|---|---|
| "đánh dấu đã thu" / "đánh dấu đã thanh toán" / "xác nhận thanh toán" | Đánh dấu PAID các hóa đơn có `#ID` trong câu | `InvoiceService#markAsPaid` |
| "chấm dứt hợp đồng" / "kết thúc hợp đồng" | Chấm dứt hợp đồng `#ID` đầu tiên tìm thấy | `ContractService#terminate` |

**Quy ước `#ID`**: người dùng nhập `#số` trong câu chat để chỉ định đối tượng. Ví dụ:
- `Đánh dấu đã thanh toán hóa đơn #5 #8 #12`
- `Chấm dứt hợp đồng #3`

Nếu thiếu ID, AI trả hướng dẫn kèm ví dụ định dạng đúng thay vì báo lỗi kỹ thuật.

### Context AI lấy từ đâu

`AiContextServiceImpl#buildContext()` dùng 5 repository với JOIN FETCH query (tránh N+1), xây dựng 11 section:

| Section | Nội dung |
|---|---|
| Khu trọ | Tên, địa chỉ, số phòng theo từng trạng thái (trống/thuê/bảo trì) |
| Tất cả phòng | Trạng thái, giá, diện tích, khách đang ở + số HĐ |
| Khách thuê | Họ tên, SĐT, email, CCCD, hợp đồng đang thuê hiện tại |
| HĐ đang hiệu lực | Đầy đủ thông tin, cảnh báo `[SAP HET HAN]` ≤30 ngày, `[GAN HET HAN]` ≤60 ngày |
| HĐ đã kết thúc | 10 hợp đồng gần nhất (TERMINATED / EXPIRED) |
| Hóa đơn UNPAID | Chi tiết từng hóa đơn chưa thu + hạn thanh toán |
| Hóa đơn OVERDUE | Chi tiết + số ngày quá hạn + SĐT khách |
| Doanh thu 12 tháng | Theo tháng + % ±so tháng trước + tóm tắt theo quý |
| Phân tích phòng trống | Ngày trống, lý do (HĐ cũ / chưa từng có HĐ), cảnh báo >30/60/90 ngày, doanh thu bị mất |
| Hành vi thanh toán | Khách đang OVERDUE + lịch sử trễ PAID (số lần, TB ngày, max ngày) |
| Hóa đơn chưa tạo | HĐ đang ACTIVE chưa có hóa đơn tháng hiện tại |
| Hiệu suất khu trọ | Tỷ lệ lấp đầy, doanh thu tháng + % vs tháng trước, nợ QH, tiềm năng |
| Thống kê tổng quan | Tỷ lệ lấp đầy, tổng nợ UNPAID + OVERDUE, đã thu tháng này, doanh thu lý thuyết |

**Query được tối ưu (JOIN FETCH, không N+1):**

- `RoomRepository#findAllWithProperty` — load room kèm property
- `ContractRepository#findAllNonDeletedWithDetails` — load contract kèm room + property + tenant
- `InvoiceRepository#findAllByStatusWithDetails` — load invoice theo status kèm contract chain
- `InvoiceRepository#findAllNonDeletedSinceWithDetails` — 13 tháng gần nhất cho phân tích trend

### System Prompt

AI được hướng dẫn:
- Trả lời dựa trên dữ liệu thực, không bịa đặt
- Phân tích và so sánh doanh thu theo tháng/quý/năm, tính % tăng giảm
- Đưa lời khuyên cụ thể theo từng tình huống (phòng trống lâu → gợi ý giảm giá/marketing; khách trễ hạn → nhắc sớm/tăng đặt cọc; HĐ hết hạn → liên hệ xác nhận gia hạn)
- **Chủ động cảnh báo** khi câu hỏi liên quan: phòng trống >30 ngày, khách ≥2 lần trễ 12 tháng, HĐ ≤30 ngày, hóa đơn chưa tạo tháng hiện tại

### FE — Sidebar gợi ý (Tab 2×2)

Sidebar được thiết kế dạng lưới 2×2 tab category, mỗi tab hiện 2–3 gợi ý ngắn:

| Tab | Icon | Gợi ý |
|---|---|---|
| Doanh thu | TrendingUp | So sánh tháng, doanh thu theo quý, tổng quan tài chính |
| Phân tích | BarChart2 | Phòng trống lâu, khách trễ hạn, hiệu suất khu trọ |
| Cảnh báo | Bell | HĐ sắp hết hạn, hóa đơn chưa tạo, tổng tiền nợ |
| Hành động | Wrench | Đánh dấu đã thu, chấm dứt hợp đồng |

Bấm tab → đổi nhóm gợi ý; bấm gợi ý → gửi câu hỏi đầy đủ vào chat.

### Cấu hình AI

- `application-groq.properties`: profile `ai-groq` hoặc `ai-groq-mysql` — dùng Groq API kiểu OpenAI-compatible
- Model hiện cấu hình: `llama-3.3-70b-versatile` (~30 000 TPM, đủ dùng production)
- Retry tự động khi Groq trả 429: tối đa 3 lần, backoff 3s → 10s (cấu hình `spring.ai.retry.*`)
- Nếu không có `ChatClient.Builder` (chạy thiếu AI profile), `AiServiceImpl` trả fallback message hướng dẫn chạy đúng profile

---

## 8. Phân tích kỹ thuật tổng thể

### Kiến trúc tổng quan

| | Frontend | Backend |
|---|---|---|
| Stack | React 18 + Vite + TypeScript | Spring Boot 3 + Java 17 |
| State | TanStack Query (`staleTime: 30s`) + Zustand | JPA/Hibernate + Spring Security |
| Auth | JWT lưu `localStorage`, interceptor tự inject | Stateless JWT filter, BCrypt password |
| API | `axiosClient` base `http://localhost:8080/api/v1` | REST, `GlobalExceptionHandler` wrap lỗi |

### Các điểm kỹ thuật đáng chú ý

#### Backend

- **Soft delete** trên `Contract` và `Invoice`: mọi truy vấn business đều filter `deleted = false`.
- **Cron job** `0 10 0 * * * (Asia/Ho_Chi_Minh)`: tự động chuyển UNPAID quá `dueDate` → OVERDUE mỗi ngày lúc 00:10.
- **Entity chain**: `Invoice → Contract → Room → Property` và `Contract → Tenant` — mọi response trả về đã flatten (không expose quan hệ lồng nhau ra API).
- `BaseEntity` dùng Spring Data Auditing (`@CreatedDate`, `@LastModifiedDate`).
- `Payment` entity và `PaymentRepository` tồn tại nhưng chưa có `PaymentService` / controller đầy đủ — chỉ được dùng ở `ContractServiceImpl` để check lịch sử trước khi xóa HĐ.

#### Frontend

- **Logic nghiệp vụ quan trọng đang nằm ở FE** (không có endpoint riêng):
  - Dashboard: tính toàn bộ thống kê từ 3 API (property / invoice / contract).
  - Search khách thuê: filter thuần client-side theo `fullName` + `phone`.
  - Gợi ý chỉ số điện/nước: FE tự duyệt tập invoice đã tải để lấy tháng trước.
- `PrivateRoute` chặn toàn bộ route theo `isAuthenticated` (Zustand) — không phân quyền theo role.
- Interceptor `axiosClient`: `401` → xóa `localStorage` + redirect `/login`; các lỗi khác → toast.

### Ghi nhận vấn đề & hạn chế hiện tại

| Vị trí | Vấn đề | Mức độ |
|---|---|---|
| `PropertyPage.tsx` | `ownerId: 1` hardcode, chưa lấy từ user đang đăng nhập | Trung bình |
| `DashboardPage.tsx` | `paidThisMonth` lọc theo `PAID` chứ không lọc theo tháng hiện tại | Nhỏ |
| `SecurityConfig.java` | Không có phân quyền theo role (ADMIN/USER), chỉ check `authenticated` | Trung bình |
| `RoomServiceImpl` | Không check trùng `roomNumber` khi **update** phòng (chỉ check khi create) | Nhỏ |
| CORS | Không cấu hình tường minh — có thể lỗi khi deploy khác domain | Trung bình |
| `AiContextServiceImpl` | ~~Context đọc DB mỗi request~~ — **đã fix**: cache volatile 2 phút, tránh build lại khi gọi liên tiếp | Đã xử lý |
| `ContractPage.tsx` | Gọi `roomApi.getById(roomId)` cho từng hợp đồng để lấy tên khu trọ — N+1 ở FE | Nhỏ |
| `Payment` entity | Tồn tại nhưng chưa có luồng nghiệp vụ hoàn chỉnh | Không ảnh hưởng |

---

## 9. Lịch sử nâng cấp

### Nâng cấp AI Assistant — 2026-05-22

#### Vấn đề ban đầu

`AiContextServiceImpl` chỉ cung cấp 4 mảnh context nhỏ: hóa đơn UNPAID, phòng AVAILABLE, HĐ sắp hết hạn 30 ngày, thống kê đơn giản. AI không biết gì về khách thuê, toàn bộ phòng, hóa đơn OVERDUE, lịch sử doanh thu, hay hành vi thanh toán.

#### Thay đổi Backend

**`RoomRepository.java`** — thêm:
```java
@Query("SELECT r FROM Room r JOIN FETCH r.property")
List<Room> findAllWithProperty();
```

**`ContractRepository.java`** — thêm:
```java
@Query("""
    SELECT c FROM Contract c
    JOIN FETCH c.room r JOIN FETCH r.property p JOIN FETCH c.tenant t
    WHERE c.deleted = false
""")
List<Contract> findAllNonDeletedWithDetails();
```

**`InvoiceRepository.java`** — thêm:
```java
@Query("""
    SELECT i FROM Invoice i
    JOIN FETCH i.contract c JOIN FETCH c.room r JOIN FETCH r.property p JOIN FETCH c.tenant t
    WHERE i.deleted = false AND i.billingMonth >= :fromMonth
""")
List<Invoice> findAllNonDeletedSinceWithDetails(@Param("fromMonth") LocalDate fromMonth);
```

**`AiContextServiceImpl.java`** — rewrite hoàn toàn:
- Thêm inject `TenantRepository`, `PropertyRepository`
- Tăng từ 4 section → 13 section (xem bảng ở mục 7)
- Dùng `ChronoUnit.DAYS.between()` thay `Period.getDays()` (fix bug tính ngày)
- Thêm 5 analytics section mới: doanh thu 12 tháng, phân tích phòng trống, hành vi thanh toán, hóa đơn chưa tạo, hiệu suất khu trọ

**`AiServiceImpl.java`** — nâng cấp system prompt:
- Chuyển sang tiếng Việt đầy đủ dấu
- Thêm hướng dẫn phân tích xu hướng, so sánh tháng/quý/năm
- Thêm hướng dẫn đưa lời khuyên cụ thể theo từng tình huống
- Thêm quy tắc chủ động cảnh báo khi phát hiện vấn đề

#### Thay đổi Frontend

**`AiChatPage.tsx`** — redesign sidebar gợi ý:
- Thay list 10 button dài → tab 2×2 (Doanh thu / Phân tích / Cảnh báo / Tạo nhanh)
- Mỗi tab chứa 2–3 gợi ý ngắn, bấm gửi câu hỏi đầy đủ
- Thêm icons: `TrendingUp`, `BarChart2`, `Bell`, `Zap` từ lucide-react
- Cập nhật welcome message phản ánh khả năng analytics mới

### Nâng cấp AI Assistant (lần 2) — 2026-05-22

#### Vấn đề

- Groq trả HTTP 429 (rate limit) khi dùng model `openai/gpt-oss-20b` (giới hạn 8 000 TPM). Mỗi request gửi ~4 500 token context, gần như chỉ xử lý được 1 request/phút.
- Tab "Tạo nhanh" (tạo khách thuê / tạo phòng qua chat) bị xóa theo yêu cầu, cần thay bằng hành động thiết thực hơn.

#### Thay đổi Backend

**`application-groq.properties`** — đổi model và thêm retry:
```properties
spring.ai.openai.chat.options.model=llama-3.3-70b-versatile
spring.ai.openai.chat.options.temperature=0.3

spring.ai.retry.max-attempts=3
spring.ai.retry.backoff.initial-interval=3000
spring.ai.retry.backoff.max-interval=10000
spring.ai.retry.backoff.multiplier=2
spring.ai.retry.on-http-codes=429
```

**`AiContextServiceImpl.java`** — thêm cache volatile 2 phút:
```java
private static final long CACHE_TTL_MS = 120_000;
private volatile String cachedContext = null;
private volatile long   cachedAt      = 0;
// buildContext() trả cache nếu chưa quá TTL, tránh đọc DB lặp lại
```

**`AiServiceImpl.java`** — xóa toàn bộ `tryHandleQuickCreate`, thêm `tryHandleDirectAction`:
- `handleMarkAsPaid`: nhận diện "đánh dấu đã thu / đã thanh toán", extract `#ID`, gọi `InvoiceService#markAsPaid` cho từng ID, trả kết quả thành công/thất bại từng hóa đơn
- `handleTerminateContract`: nhận diện "chấm dứt hợp đồng / kết thúc hợp đồng", extract `#ID` đầu tiên, gọi `ContractService#terminate`, trả tóm tắt kết quả

#### Thay đổi Frontend

**`AiChatPage.tsx`** — thay tab "Tạo nhanh" (`Zap`) bằng tab "Hành động" (`Wrench`):
- Xóa 2 item: "Thêm khách thuê mới", "Thêm phòng mới"
- Thêm 2 item: "Đánh dấu đã thu" (gửi message mẫu + hướng dẫn nhập `#ID`), "Chấm dứt hợp đồng"

### Nâng cấp Hợp đồng & Hóa đơn — 2026-05-22

#### Vấn đề

Khi tạo hóa đơn, admin phải tự nhập lại số người mỗi tháng vào ô "Dịch vụ chung" — thông tin này thực chất đã biết ngay từ lúc ký hợp đồng và không thay đổi theo tháng.

#### Thay đổi Backend

**`Contract.java`** — thêm field:
```java
@Column(name = "number_of_people")
private Integer numberOfPeople;
```

**`ContractRequest.java`** — thêm field với validation:
```java
@Min(value = 1, message = "Số người trong phòng phải ít nhất là 1")
private Integer numberOfPeople;
```

**`ContractResponse.java`** — thêm field `numberOfPeople` vào response.

**`ContractServiceImpl.java`**:
- `create()`: lưu `numberOfPeople` từ request vào entity
- `toResponse()`: trả `numberOfPeople` về FE

**`InvoiceRequest.java`** — xóa field `servicePeople` (không còn nhận từ FE).

**`InvoiceServiceImpl.java`** — đổi nguồn lấy số người:
```java
// Trước: int servicePeople = request.getServicePeople() != null ? request.getServicePeople() : 0;
int servicePeople = contract.getNumberOfPeople() != null ? contract.getNumberOfPeople() : 0;
```

> **DB migration:** Cần thêm column `ALTER TABLE contracts ADD COLUMN number_of_people INT NULL;`
> Hợp đồng cũ có `number_of_people = NULL` → `servicePeople = 0` khi tạo hóa đơn (an toàn).

#### Thay đổi Frontend

**`types/index.ts`** — thêm `numberOfPeople?: number | null` vào interface `Contract`.

**`contractApi.ts`** — thêm `numberOfPeople?: number` vào interface `ContractRequest`.

**`invoiceApi.ts`** — xóa `servicePeople` khỏi interface `InvoiceRequest`.

**`ContractPage.tsx`**:
- Thêm field "Số người trong phòng" vào form tạo hợp đồng (validation `min: 1`)
- Hiển thị số người trong modal xác nhận trước khi tạo
- Schema zod thêm `numberOfPeople: z.coerce.number().min(1)`

**`InvoicePage.tsx`**:
- Xóa input "Số người" khỏi form tạo hóa đơn
- Thay bằng ô read-only hiển thị số người lấy từ `selectedContract.numberOfPeople`
- Preview phí dịch vụ tự tính: `contractNumberOfPeople × serviceUnitPrice`
- Xóa `useEffect` từng set `servicePeople` từ hóa đơn tháng trước
- Xóa `watchedServicePeople` khỏi `watch()`

