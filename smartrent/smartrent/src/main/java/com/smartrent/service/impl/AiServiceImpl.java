package com.smartrent.service.impl;

import com.smartrent.dto.request.AiChatRequest;
import com.smartrent.dto.response.AiAlertsResponse;
import com.smartrent.dto.response.AiChatResponse;
import com.smartrent.service.AiContextService;
import com.smartrent.service.AiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AiServiceImpl implements AiService {

    private final ObjectProvider<ChatClient.Builder> chatClientBuilderProvider;
    private final AiContextService aiContextService;
    private final Environment environment;
    private final RestClient restClient;

    @Value("${gemini.api-key:}")
    private String geminiApiKey;

    @Value("${gemini.model:gemini-2.0-flash}")
    private String geminiModel;

    private static final int MAX_HISTORY = 4;

    private static final String SYSTEM_PROMPT = """
            Bạn là trợ lý AI của SmartRent (quản lý phòng trọ). Trả lời tiếng Việt, ngắn gọn, chính xác.
            - Chỉ dùng dữ liệu được cung cấp. Không có dữ liệu → "Không có dữ liệu."
            - **In đậm** số tiền, tên, con số quan trọng. Dùng `- ` cho danh sách. ## cho tiêu đề. KHÔNG dùng bảng (|).
            - Tên khách thuê LUÔN kèm risk label: **Tên** [RỦI RO CAO / TRUNG BÌNH / ĐÁNG TIN CẬY].
            - Tư vấn: gợi ý cụ thể, ưu tiên rõ ràng. Phòng trống lâu → giảm giá/quảng cáo. Khách trễ hạn → nhắc sớm/đặt cọc cao hơn.
            - Dự báo doanh thu: lý thuyết × tỷ lệ thu 6 tháng = dự báo (trình bày cả 3 con số).
            - "Báo cáo hôm nay" → ## Tình hình [ngày] / - hóa đơn đến hạn 7 ngày / - HĐ sắp hết hạn 30 ngày / - phòng trống / **Ưu tiên:** [1-2 việc].
            """;

    public AiServiceImpl(ObjectProvider<ChatClient.Builder> chatClientBuilderProvider,
                         AiContextService aiContextService,
                         Environment environment,
                         RestClient.Builder restClientBuilder) {
        this.chatClientBuilderProvider = chatClientBuilderProvider;
        this.aiContextService = aiContextService;
        this.environment = environment;
        this.restClient = restClientBuilder.build();
    }

    @Override
    public AiChatResponse chat(String message, List<AiChatRequest.ChatHistoryItem> history) {
        boolean isGeminiProfile = Arrays.asList(environment.getActiveProfiles()).contains("gemini");
        if (isGeminiProfile && !geminiApiKey.isBlank()) {
            return chatViaGeminiDirect(message, history);
        }
        return chatViaSpringAi(message, history);
    }

    @Override
    public AiAlertsResponse getAlerts() {
        return aiContextService.buildAlerts();
    }

    // ── Direct Gemini REST API call ────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private AiChatResponse chatViaGeminiDirect(String message, List<AiChatRequest.ChatHistoryItem> history) {
        String context = aiContextService.buildContext();
        String fullUserMessage = """
                Dữ liệu hiện tại của hệ thống:

                %s

                Câu hỏi của chủ trọ: %s
                """.formatted(context, message);

        log.info("Gemini direct query: {}", message);

        // Build contents array (history + current message)
        List<Map<String, Object>> contents = new ArrayList<>();
        if (history != null && !history.isEmpty()) {
            List<AiChatRequest.ChatHistoryItem> limited = history.size() > MAX_HISTORY
                    ? history.subList(history.size() - MAX_HISTORY, history.size())
                    : history;
            for (AiChatRequest.ChatHistoryItem item : limited) {
                // Gemini dùng "model" thay vì "assistant"
                String role = "assistant".equals(item.getRole()) ? "model" : "user";
                contents.add(Map.of("role", role, "parts", List.of(Map.of("text", item.getContent()))));
            }
        }
        contents.add(Map.of("role", "user", "parts", List.of(Map.of("text", fullUserMessage))));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("system_instruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
        body.put("contents", contents);
        body.put("generationConfig", Map.of("temperature", 0.3));

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + geminiApiKey;

        try {
            Map<?, ?> response = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            List<Map<?, ?>> candidates = (List<Map<?, ?>>) response.get("candidates");
            Map<?, ?> content = (Map<?, ?>) candidates.get(0).get("content");
            List<Map<?, ?>> parts = (List<Map<?, ?>>) content.get("parts");
            String answer = (String) parts.get(0).get("text");

            log.info("Gemini answer received ({} chars)", answer.length());
            return AiChatResponse.builder().question(message).answer(answer).build();

        } catch (HttpStatusCodeException ex) {
            String body2 = ex.getResponseBodyAsString();
            int status = ex.getStatusCode().value();
            log.warn("Gemini HTTP {}: {}", status, body2);

            if (status == 429 || body2.contains("RESOURCE_EXHAUSTED")) {
                return AiChatResponse.builder().question(message)
                        .answer("Hệ thống AI đang bận (vượt giới hạn request/phút). Vui lòng chờ 30–60 giây rồi thử lại.")
                        .build();
            }
            return AiChatResponse.builder().question(message)
                    .answer("Dịch vụ Gemini trả lỗi HTTP " + status + ". Vui lòng thử lại sau.")
                    .build();

        } catch (Exception ex) {
            log.error("Gemini unexpected error: {}", ex.getMessage(), ex);
            return AiChatResponse.builder().question(message)
                    .answer("Có lỗi kết nối Gemini. Vui lòng kiểm tra API key và thử lại.")
                    .build();
        }
    }

    // ── Spring AI path (Groq / OpenAI) ────────────────────────────────────────

    private AiChatResponse chatViaSpringAi(String message, List<AiChatRequest.ChatHistoryItem> history) {
        ChatClient.Builder chatClientBuilder = chatClientBuilderProvider.getIfAvailable();
        if (chatClientBuilder == null) {
            log.warn("AI chat unavailable. Active profiles: {}", Arrays.toString(environment.getActiveProfiles()));
            return AiChatResponse.builder()
                    .question(message)
                    .answer("Tính năng AI chưa sẵn sàng. Hãy chạy backend với profile ai-gemini-mysql, ai-groq-mysql hoặc ai-ollama-mysql.")
                    .build();
        }

        String context = aiContextService.buildContext();
        String fullUserMessage = """
                Dữ liệu hiện tại của hệ thống:

                %s

                Câu hỏi của chủ trọ: %s
                """.formatted(context, message);

        log.info("Spring AI query: {}", message);

        List<Message> allMessages = new ArrayList<>();
        allMessages.add(new SystemMessage(SYSTEM_PROMPT));
        allMessages.addAll(buildHistoryMessages(history));
        allMessages.add(new UserMessage(fullUserMessage));

        try {
            String answer = chatClientBuilder.build()
                    .prompt(new Prompt(allMessages))
                    .call().content();
            log.info("Spring AI answer received ({} chars)", answer.length());
            return AiChatResponse.builder().question(message).answer(answer).build();

        } catch (Exception ex) {
            String msg = ex.getMessage() != null ? ex.getMessage() : "";
            if (msg.contains("429") || msg.contains("rate_limit") || msg.contains("Rate limit")
                    || msg.contains("RESOURCE_EXHAUSTED") || msg.contains("quota")) {
                log.warn("AI rate limit hit: {}", msg);
                return AiChatResponse.builder().question(message)
                        .answer("Hệ thống AI đang bận (vượt giới hạn request/phút). Vui lòng chờ 30–60 giây rồi thử lại.")
                        .build();
            }
            log.error("Spring AI unexpected error: {}", msg, ex);
            return AiChatResponse.builder().question(message)
                    .answer("Có lỗi kết nối AI. Vui lòng thử lại hoặc kiểm tra API key.")
                    .build();
        }
    }

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
}
