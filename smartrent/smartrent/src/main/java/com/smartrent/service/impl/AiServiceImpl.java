package com.smartrent.service.impl;

import com.smartrent.dto.response.AiChatResponse;
import com.smartrent.service.AiContextService;
import com.smartrent.service.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.util.Arrays;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiServiceImpl implements AiService {

    private final ObjectProvider<ChatClient.Builder> chatClientBuilderProvider; // KIỂM TRA AI SẴN SÀNG CHƯA
    private final AiContextService aiContextService;
    private final Environment environment;

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
            log.warn("AI chat is unavailable. Active profiles: {}", Arrays.toString(environment.getActiveProfiles()));
            return AiChatResponse.builder()
                    .question(message)
                    .answer("Tinh nang AI chua san sang. Hay chay backend voi profile ai-groq, ai-groq-mysql, ai-openai hoac ai-openai-mysql. Neu dung Groq va muon giu du lieu MySQL hien tai, dung ai-groq-mysql.")
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
