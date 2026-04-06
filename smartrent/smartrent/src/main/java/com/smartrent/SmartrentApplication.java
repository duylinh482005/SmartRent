package com.smartrent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaAuditing
@EnableScheduling
@EnableConfigurationProperties
public class SmartrentApplication {
    public static void main(String[] args) {
        autoActivateAiProfile();
        SpringApplication.run(SmartrentApplication.class, args);
    }

    private static void autoActivateAiProfile() {
        String systemActiveProfiles = System.getProperty("spring.profiles.active");
        String envActiveProfiles = System.getenv("SPRING_PROFILES_ACTIVE");

        if (hasText(systemActiveProfiles) || hasText(envActiveProfiles)) {
            return;
        }

        if (hasText(System.getenv("GROQ_API_KEY"))) {
            System.setProperty("spring.profiles.active", "ai-groq");
            return;
        }

        if (hasText(System.getenv("OPENAI_API_KEY"))) {
            System.setProperty("spring.profiles.active", "ai-openai");
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
