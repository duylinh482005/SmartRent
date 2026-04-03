package com.smartrent.service.impl;

import com.smartrent.dto.response.AiChatResponse;
import com.smartrent.service.AiContextService;
import com.smartrent.service.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiServiceImpl implements AiService {

    private final ObjectProvider<ChatClient.Builder> chatClientBuilderProvider;
    private final AiContextService aiContextService;

    private static final String SYSTEM_PROMPT = """
            Ban la tro ly AI cua he thong quan ly phong tro SmartRent.
            Tra loi ngan gon, ro rang, bang tieng Viet khong dau.
            Chi duoc dua tren du lieu duoc cung cap, khong duoc bia dat.
            Neu khong co du lieu lien quan, tra loi: Khong co du lieu.
            """;

    @Override
    public AiChatResponse chat(String message) {
        ChatClient.Builder chatClientBuilder = chatClientBuilderProvider.getIfAvailable();
        if (chatClientBuilder == null) {
            return AiChatResponse.builder()
                    .question(message)
                    .answer("Tinh nang AI dang tat. Hay cau hinh OPENAI_API_KEY va SPRING_AI_MODEL_CHAT=openai de su dung.")
                    .build();
        }

        String context = aiContextService.buildContext();
        String fullUserMessage = """
                Du lieu hien tai cua he thong:\n\n%s\n\nCau hoi cua chu tro: %s
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
}
