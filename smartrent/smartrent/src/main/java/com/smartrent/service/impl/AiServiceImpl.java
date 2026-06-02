package com.smartrent.service.impl;

import com.smartrent.dto.request.AiChatRequest;
import com.smartrent.dto.request.ContractUpdateRequest;
import com.smartrent.dto.response.AiChatResponse;
import com.smartrent.dto.response.ContractResponse;
import com.smartrent.dto.response.RoomResponse;
import com.smartrent.entity.Room;
import com.smartrent.service.AiContextService;
import com.smartrent.service.AiService;
import com.smartrent.service.ContractService;
import com.smartrent.service.InvoiceService;
import com.smartrent.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiServiceImpl implements AiService {

    private final ObjectProvider<ChatClient.Builder> chatClientBuilderProvider;
    private final AiContextService aiContextService;
    private final InvoiceService invoiceService;
    private final ContractService contractService;
    private final RoomService roomService;
    private final Environment environment;

    private static final Pattern ID_PATTERN     = Pattern.compile("#(\\d+)");
    private static final Pattern MONTHS_PATTERN = Pattern.compile("(\\d+)\\s*tháng");
    private static final Pattern RENT_PATTERN   = Pattern.compile("(?:tiền thuê|giá thuê)\\s+([\\d.,]+)");
    private static final Pattern PEOPLE_PATTERN = Pattern.compile("số người\\s+(\\d+)");
    private static final DateTimeFormatter DATE_FMT  = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MM/yyyy");
    private static final int MAX_HISTORY = 10;

    private static final String SYSTEM_PROMPT = """
            Bạn là trợ lý AI thông minh của hệ thống quản lý phòng trọ SmartRent.
            Bạn có quyền truy cập TOÀN BỘ dữ liệu: khu trọ, phòng, khách thuê, hợp đồng,
            lịch sử hóa đơn 12 tháng, phân tích phòng trống, hành vi thanh toán, hiệu suất khu trọ.

            NGUYÊN TẮC TRẢ LỜI:
            - Trả lời bằng tiếng Việt, ngắn gọn và rõ ràng.
            - Chỉ dựa trên dữ liệu được cung cấp, không bịa đặt.
            - Nếu không có dữ liệu: trả lời "Không có dữ liệu."
            - Câu hỏi số liệu: trả lời con số cụ thể.
            - Câu hỏi liệt kê: dùng danh sách `- `, luôn kèm ID (#số) để dễ thao tác.
            - Câu hỏi về đối tượng cụ thể: tìm chính xác và trả lời đầy đủ.
            - Nhớ ngữ cảnh cuộc hội thoại trước để trả lời liên quan.

            ĐỊNH DẠNG MARKDOWN (bắt buộc dùng):
            - Dùng **in đậm** cho số tiền, tên phòng, tên khách, con số quan trọng.
            - Dùng ## cho tiêu đề phần khi trả lời dài nhiều mục.
            - Dùng `- ` cho danh sách.
            - KHÔNG dùng bảng markdown (|), thay bằng danh sách.

            PHÂN TÍCH & TƯ VẤN:
            - So sánh doanh thu: dùng dữ liệu tháng/quý/năm để tính % tăng giảm, nhận xét xu hướng.
            - Khi được hỏi tư vấn hoặc "nên làm gì", đưa ra gợi ý cụ thể, có ưu tiên.
            - Với phòng trống lâu: gợi ý giảm giá thử nghiệm, đăng quảng cáo, kiểm tra tình trạng phòng.
            - Với khách hay trễ hạn: gợi ý nhắc trước 5–7 ngày, xem xét đặt cọc cao hơn, hoặc không gia hạn hợp đồng.
            - Với hợp đồng sắp hết hạn: gợi ý liên hệ khách thuê sớm để xác nhận gia hạn hay trả phòng.
            - Với hóa đơn chưa tạo: nhắc nhở cần tạo hóa đơn tháng này.
            - Với doanh thu giảm: phân tích nguyên nhân (phòng trống, chậm thu...) và gợi ý cải thiện.

            CHỦ ĐỘNG CẢNH BÁO (ngay cả khi không được hỏi trực tiếp, nếu câu hỏi liên quan):
            - Phòng trống >30 ngày và doanh thu bị mất.
            - Khách có ≥2 lần trễ hạn trong 12 tháng.
            - Hợp đồng còn ≤30 ngày mà chưa có tín hiệu gia hạn.
            - Hóa đơn chưa tạo cho tháng hiện tại.

            HÀNH ĐỘNG TRỰC TIẾP (hệ thống tự tra ID từ ngữ cảnh nếu bạn không cung cấp #ID):
            - Đánh dấu đã thu: "Đánh dấu đã thanh toán hóa đơn #5 #8"
            - Chấm dứt hợp đồng: "Chấm dứt hợp đồng #3"
              → Nếu vừa hỏi về hợp đồng cụ thể: "Chấm dứt hợp đồng đó" (hệ thống tự lấy ID)
            - Sửa hợp đồng (có thể kết hợp nhiều thay đổi trong một lệnh):
              + "Gia hạn thêm 6 tháng" (tự lấy ID từ ngữ cảnh cuộc hội thoại)
              + "Sửa hợp đồng #3 tiền thuê 3500000"
              + "Sửa hợp đồng #3 số người 2"
              + Kết hợp: "Sửa hợp đồng #3 thêm 6 tháng tiền thuê 4000000 số người 3"
            - Chuyển phòng bảo trì: "Đặt phòng #7 vào bảo trì"
            - Mở lại phòng: "Phòng #7 sửa xong"
            - Lưu ý: KHÔNG thể đổi trạng thái phòng đang có khách thuê. Phải chấm dứt hợp đồng trước.
            """;

    @Override
    public AiChatResponse chat(String message, List<AiChatRequest.ChatHistoryItem> history) {
        Optional<String> directResponse = tryHandleDirectAction(message, history);
        if (directResponse.isPresent()) {
            return AiChatResponse.builder()
                    .question(message)
                    .answer(directResponse.get())
                    .build();
        }

        ChatClient.Builder chatClientBuilder = chatClientBuilderProvider.getIfAvailable();
        if (chatClientBuilder == null) {
            log.warn("AI chat is unavailable. Active profiles: {}", Arrays.toString(environment.getActiveProfiles()));
            return AiChatResponse.builder()
                    .question(message)
                    .answer("Tính năng AI chưa sẵn sàng. Hãy chạy backend với profile ai-groq-mysql hoặc ai-groq.")
                    .build();
        }

        String context = aiContextService.buildContext();
        String fullUserMessage = """
                Dữ liệu hiện tại của hệ thống:

                %s

                Câu hỏi của chủ trọ: %s
                """.formatted(context, message);

        log.info("AI query: {}", message);

        List<Message> historyMessages = buildHistoryMessages(history);

        List<Message> allMessages = new ArrayList<>();
        allMessages.add(new SystemMessage(SYSTEM_PROMPT));
        allMessages.addAll(historyMessages);
        allMessages.add(new UserMessage(fullUserMessage));

        ChatClient chatClient = chatClientBuilder.build();
        String answer = chatClient.prompt(new Prompt(allMessages)).call().content();

        log.info("AI answer: {}", answer);

        return AiChatResponse.builder()
                .question(message)
                .answer(answer)
                .build();
    }

    // ── History builder ───────────────────────────────────────────────────────

    private List<Message> buildHistoryMessages(List<AiChatRequest.ChatHistoryItem> history) {
        if (history == null || history.isEmpty()) return List.of();

        List<AiChatRequest.ChatHistoryItem> limited = history.size() > MAX_HISTORY
                ? history.subList(history.size() - MAX_HISTORY, history.size())
                : history;

        List<Message> messages = new ArrayList<>();
        for (AiChatRequest.ChatHistoryItem item : limited) {
            if ("user".equals(item.getRole())) {
                messages.add(new UserMessage(item.getContent()));
            } else if ("assistant".equals(item.getRole())) {
                messages.add(new AssistantMessage(item.getContent()));
            }
        }
        return messages;
    }

    // ── Direct action dispatcher ──────────────────────────────────────────────

    private Optional<String> tryHandleDirectAction(String message, List<AiChatRequest.ChatHistoryItem> history) {
        String normalized = message.toLowerCase();

        // Always intercept — intent is unambiguous even without ID
        if (normalized.contains("xác nhận thanh toán") || normalized.contains("đánh dấu thanh toán")
                || normalized.contains("đánh dấu đã thu") || normalized.contains("đánh dấu đã thanh toán")) {
            return Optional.of(handleMarkAsPaid(resolveIds(message, history)));
        }
        if (normalized.contains("chấm dứt hợp đồng") || normalized.contains("kết thúc hợp đồng")) {
            return Optional.of(handleTerminateContract(resolveIds(message, history)));
        }

        // Edit contract: only intercept when an ID is available (message or history)
        // to avoid capturing general questions like "làm thế nào để gia hạn hợp đồng?"
        boolean editIntent = normalized.contains("sửa hợp đồng")
                || (normalized.contains("gia hạn") && MONTHS_PATTERN.matcher(normalized).find());
        if (editIntent) {
            List<Long> ids = resolveIds(message, history);
            if (!ids.isEmpty()) {
                return Optional.of(handleEditContract(message, ids));
            }
        }

        // Room status: only intercept when an ID is available
        if (normalized.contains("bảo trì") && normalized.contains("phòng")) {
            List<Long> ids = resolveIds(message, history);
            if (!ids.isEmpty()) {
                return Optional.of(handleRoomStatus(ids, Room.Status.MAINTENANCE));
            }
        }
        if (normalized.contains("sửa xong") || normalized.contains("mở lại phòng")) {
            List<Long> ids = resolveIds(message, history);
            if (!ids.isEmpty()) {
                return Optional.of(handleRoomStatus(ids, Room.Status.AVAILABLE));
            }
        }

        return Optional.empty();
    }

    // ── Action: mark invoices as paid ─────────────────────────────────────────

    private String handleMarkAsPaid(List<Long> ids) {
        if (ids.isEmpty()) {
            return "Vui lòng cung cấp ID hóa đơn theo định dạng #số. Ví dụ:\nĐánh dấu đã thanh toán hóa đơn #5 #8 #12";
        }

        List<String> success = new ArrayList<>();
        List<String> failed  = new ArrayList<>();
        for (Long id : ids) {
            try {
                var inv = invoiceService.markAsPaid(id);
                success.add(String.format("✓ HD#%d — Phòng %s (%s), tháng %s, %,.0f đ",
                        id, inv.getRoomNumber(), inv.getPropertyName(),
                        inv.getBillingMonth().format(MONTH_FMT), inv.getTotalAmount()));
            } catch (RuntimeException ex) {
                failed.add(String.format("✗ HD#%d — %s", id, ex.getMessage()));
            }
        }

        StringBuilder sb = new StringBuilder();
        if (!success.isEmpty()) {
            sb.append("Đã xác nhận thanh toán:\n");
            success.forEach(s -> sb.append(s).append("\n"));
        }
        if (!failed.isEmpty()) {
            if (!sb.isEmpty()) sb.append("\n");
            sb.append("Không thể xác nhận:\n");
            failed.forEach(f -> sb.append(f).append("\n"));
        }
        return sb.toString().trim();
    }

    // ── Action: terminate contract ────────────────────────────────────────────

    private String handleTerminateContract(List<Long> ids) {
        if (ids.isEmpty()) {
            return "Vui lòng cung cấp ID hợp đồng theo định dạng #số. Ví dụ:\nChấm dứt hợp đồng #3";
        }
        if (ids.size() > 1) {
            String idList = ids.stream().map(i -> "#" + i).collect(Collectors.joining(", "));
            return "Tìm thấy nhiều hợp đồng trong cuộc trò chuyện vừa rồi: " + idList
                    + "\nBạn muốn chấm dứt hợp đồng nào? Vui lòng gửi lại lệnh kèm #ID cụ thể.";
        }

        Long id = ids.get(0);
        try {
            ContractResponse contract = contractService.terminate(id);
            return String.format(
                    "Đã chấm dứt hợp đồng #%d.\nPhòng %s (%s) — Khách: %s\nPhòng đã chuyển về trạng thái trống.",
                    id, contract.getRoomNumber(), contract.getPropertyName(), contract.getTenantName());
        } catch (RuntimeException ex) {
            return "Không thể chấm dứt hợp đồng #" + id + ": " + ex.getMessage();
        }
    }

    // ── Action: edit contract (extend months / change rent / change people) ───

    private String handleEditContract(String message, List<Long> ids) {
        if (ids.isEmpty()) {
            return "Vui lòng cung cấp ID hợp đồng theo định dạng #số. Ví dụ:\n" +
                   "Sửa hợp đồng #3 thêm 6 tháng\n" +
                   "Sửa hợp đồng #3 tiền thuê 3500000\n" +
                   "Sửa hợp đồng #3 số người 2";
        }
        if (ids.size() > 1) {
            String idList = ids.stream().map(i -> "#" + i).collect(Collectors.joining(", "));
            return "Tìm thấy nhiều hợp đồng trong cuộc trò chuyện vừa rồi: " + idList
                    + "\nBạn muốn sửa hợp đồng nào? Vui lòng gửi lại lệnh kèm #ID cụ thể, ví dụ:\n"
                    + "Sửa hợp đồng #" + ids.get(0) + " thêm 6 tháng";
        }

        Long id = ids.get(0);
        String lower = message.toLowerCase();

        ContractUpdateRequest.ContractUpdateRequestBuilder reqBuilder = ContractUpdateRequest.builder();
        List<String> changes = new ArrayList<>();

        Matcher monthMatcher = MONTHS_PATTERN.matcher(lower);
        if (monthMatcher.find()) {
            int months = Integer.parseInt(monthMatcher.group(1));
            try {
                ContractResponse current = contractService.getById(id);
                LocalDate newEndDate = current.getEndDate().plusMonths(months);
                reqBuilder.endDate(newEndDate);
                changes.add(String.format("gia hạn +%d tháng → hết hạn %s", months, newEndDate.format(DATE_FMT)));
            } catch (RuntimeException ex) {
                return "Không thể đọc hợp đồng #" + id + ": " + ex.getMessage();
            }
        }

        Matcher rentMatcher = RENT_PATTERN.matcher(lower);
        if (rentMatcher.find()) {
            String rawNumber = rentMatcher.group(1).replaceAll("[.,]", "");
            BigDecimal rent = new BigDecimal(rawNumber);
            reqBuilder.monthlyRent(rent);
            changes.add(String.format("tiền thuê → %,.0f đ/tháng", rent));
        }

        Matcher peopleMatcher = PEOPLE_PATTERN.matcher(lower);
        if (peopleMatcher.find()) {
            int people = Integer.parseInt(peopleMatcher.group(1));
            reqBuilder.numberOfPeople(people);
            changes.add("số người → " + people);
        }

        if (changes.isEmpty()) {
            return "Vui lòng chỉ định nội dung muốn sửa:\n" +
                   "- Gia hạn: Sửa hợp đồng #" + id + " thêm 6 tháng\n" +
                   "- Giá thuê: Sửa hợp đồng #" + id + " tiền thuê 3500000\n" +
                   "- Số người: Sửa hợp đồng #" + id + " số người 2";
        }

        try {
            ContractResponse updated = contractService.update(id, reqBuilder.build());
            return String.format("Đã cập nhật hợp đồng #%d: %s\nPhòng %s (%s) — Khách: %s",
                    id, String.join(", ", changes),
                    updated.getRoomNumber(), updated.getPropertyName(), updated.getTenantName());
        } catch (RuntimeException ex) {
            return "Không thể cập nhật hợp đồng #" + id + ": " + ex.getMessage();
        }
    }

    // ── Action: change room status ────────────────────────────────────────────

    private String handleRoomStatus(List<Long> ids, Room.Status targetStatus) {
        if (ids.isEmpty()) {
            String example = targetStatus == Room.Status.MAINTENANCE
                    ? "Đặt phòng #7 vào bảo trì" : "Phòng #7 sửa xong";
            return "Vui lòng cung cấp ID phòng theo định dạng #số. Ví dụ:\n" + example;
        }

        List<String> success = new ArrayList<>();
        List<String> failed  = new ArrayList<>();
        for (Long id : ids) {
            try {
                RoomResponse room = roomService.updateStatus(id, targetStatus);
                String label = targetStatus == Room.Status.MAINTENANCE ? "bảo trì" : "còn trống";
                success.add(String.format("✓ Phòng #%d (%s - %s) → %s",
                        id, room.getRoomNumber(), room.getPropertyName(), label));
            } catch (RuntimeException ex) {
                failed.add(String.format("✗ Phòng #%d — %s", id, ex.getMessage()));
            }
        }

        String header = targetStatus == Room.Status.MAINTENANCE
                ? "Đã chuyển sang bảo trì:\n" : "Đã mở lại (còn trống):\n";
        StringBuilder sb = new StringBuilder();
        if (!success.isEmpty()) {
            sb.append(header);
            success.forEach(s -> sb.append(s).append("\n"));
        }
        if (!failed.isEmpty()) {
            if (!sb.isEmpty()) sb.append("\n");
            sb.append("Không thể xử lý:\n");
            failed.forEach(f -> sb.append(f).append("\n"));
        }
        return sb.toString().trim();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Returns IDs from the current message first; falls back to the most recent
     * assistant message in history that contains at least one #ID.
     */
    private List<Long> resolveIds(String message, List<AiChatRequest.ChatHistoryItem> history) {
        List<Long> fromMessage = extractIds(message);
        if (!fromMessage.isEmpty()) return fromMessage;
        return extractIdsFromLastAssistantMessage(history);
    }

    private List<Long> extractIdsFromLastAssistantMessage(List<AiChatRequest.ChatHistoryItem> history) {
        if (history == null || history.isEmpty()) return List.of();
        for (int i = history.size() - 1; i >= 0; i--) {
            if ("assistant".equals(history.get(i).getRole())) {
                List<Long> ids = extractIds(history.get(i).getContent());
                if (!ids.isEmpty()) return ids;
            }
        }
        return List.of();
    }

    private List<Long> extractIds(String message) {
        List<Long> ids = new ArrayList<>();
        Matcher matcher = ID_PATTERN.matcher(message);
        while (matcher.find()) {
            ids.add(Long.parseLong(matcher.group(1)));
        }
        return ids;
    }
}
