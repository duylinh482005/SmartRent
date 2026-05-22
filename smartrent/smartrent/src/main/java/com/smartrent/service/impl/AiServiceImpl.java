package com.smartrent.service.impl;

import com.smartrent.dto.response.AiChatResponse;
import com.smartrent.service.AiContextService;
import com.smartrent.service.AiService;
import com.smartrent.service.ContractService;
import com.smartrent.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiServiceImpl implements AiService {

    private final ObjectProvider<ChatClient.Builder> chatClientBuilderProvider;
    private final AiContextService aiContextService;
    private final InvoiceService invoiceService;
    private final ContractService contractService;
    private final Environment environment;

    private static final Pattern ID_PATTERN = Pattern.compile("#(\\d+)");
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MM/yyyy");

    private static final String SYSTEM_PROMPT = """
            Bạn là trợ lý AI thông minh của hệ thống quản lý phòng trọ SmartRent.
            Bạn có quyền truy cập TOÀN BỘ dữ liệu: khu trọ, phòng, khách thuê, hợp đồng,
            lịch sử hóa đơn 12 tháng, phân tích phòng trống, hành vi thanh toán, hiệu suất khu trọ.

            NGUYÊN TẮC TRẢ LỜI:
            - Trả lời bằng tiếng Việt, ngắn gọn và rõ ràng.
            - Chỉ dựa trên dữ liệu được cung cấp, không bịa đặt.
            - Nếu không có dữ liệu: trả lời "Không có dữ liệu."
            - Câu hỏi số liệu: trả lời con số cụ thể.
            - Câu hỏi liệt kê: dùng danh sách dấu gạch đầu dòng, luôn kèm ID (#số) để dễ thao tác.
            - Câu hỏi về đối tượng cụ thể: tìm chính xác và trả lời đầy đủ.

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
            """;

    @Override
    public AiChatResponse chat(String message) {
        Optional<String> directResponse = tryHandleDirectAction(message);
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

        ChatClient chatClient = chatClientBuilder.build();
        String answer = chatClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(fullUserMessage)
                .call()
                .content();

        log.info("AI answer: {}", answer);

        return AiChatResponse.builder()
                .question(message)
                .answer(answer)
                .build();
    }

    // ── Direct action dispatcher ──────────────────────────────────────────────

    private Optional<String> tryHandleDirectAction(String message) {
        String normalized = message.toLowerCase();
        if (normalized.contains("xác nhận thanh toán") || normalized.contains("đánh dấu thanh toán")
                || normalized.contains("đánh dấu đã thu") || normalized.contains("đánh dấu đã thanh toán")) {
            return Optional.of(handleMarkAsPaid(message));
        }
        if (normalized.contains("chấm dứt hợp đồng") || normalized.contains("kết thúc hợp đồng")) {
            return Optional.of(handleTerminateContract(message));
        }
        return Optional.empty();
    }

    // ── Action: mark invoices as paid ─────────────────────────────────────────

    private String handleMarkAsPaid(String message) {
        List<Long> ids = extractIds(message);
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

    private String handleTerminateContract(String message) {
        List<Long> ids = extractIds(message);
        if (ids.isEmpty()) {
            return "Vui lòng cung cấp ID hợp đồng theo định dạng #số. Ví dụ:\nChấm dứt hợp đồng #3";
        }

        Long id = ids.get(0);
        try {
            var contract = contractService.terminate(id);
            return String.format(
                    "Đã chấm dứt hợp đồng #%d.\nPhòng %s (%s) — Khách: %s\nPhòng đã chuyển về trạng thái trống.",
                    id, contract.getRoomNumber(), contract.getPropertyName(), contract.getTenantName());
        } catch (RuntimeException ex) {
            return "Không thể chấm dứt hợp đồng #" + id + ": " + ex.getMessage();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Long> extractIds(String message) {
        List<Long> ids = new ArrayList<>();
        Matcher matcher = ID_PATTERN.matcher(message);
        while (matcher.find()) {
            ids.add(Long.parseLong(matcher.group(1)));
        }
        return ids;
    }
}
