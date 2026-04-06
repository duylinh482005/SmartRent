package com.smartrent.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.observation.ChatModelObservationConvention;
import org.springframework.ai.model.openai.autoconfigure.OpenAIAutoConfigurationUtil;
import org.springframework.ai.model.openai.autoconfigure.OpenAiChatProperties;
import org.springframework.ai.model.openai.autoconfigure.OpenAiConnectionProperties;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.ai.retry.RetryUtils;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;
import org.springframework.core.retry.RetryTemplate;
import org.springframework.web.client.ResponseErrorHandler;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.WebClient;

import io.micrometer.observation.ObservationRegistry;

@Configuration
@EnableConfigurationProperties({
        OpenAiConnectionProperties.class,
        OpenAiChatProperties.class
})
public class AiConfig {

    @Bean
    @ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "openai")
    @ConditionalOnMissingBean(OpenAiApi.class)
    public OpenAiApi openAiApi(
            OpenAiConnectionProperties connectionProperties,
            OpenAiChatProperties chatProperties,
            ObjectProvider<RestClient.Builder> restClientBuilderProvider,
            ObjectProvider<WebClient.Builder> webClientBuilderProvider,
            ObjectProvider<ResponseErrorHandler> responseErrorHandlerProvider) {

        OpenAIAutoConfigurationUtil.ResolvedConnectionProperties resolved =
                OpenAIAutoConfigurationUtil.resolveConnectionProperties(
                        connectionProperties, chatProperties, "chat");

        return OpenAiApi.builder()
                .baseUrl(resolved.baseUrl())
                .apiKey(resolved.apiKey())
                .headers(resolved.headers())
                .completionsPath(chatProperties.getCompletionsPath())
                .embeddingsPath("/v1/embeddings")
                .restClientBuilder(restClientBuilderProvider.getIfAvailable(RestClient::builder))
                .webClientBuilder(webClientBuilderProvider.getIfAvailable(WebClient::builder))
                .responseErrorHandler(responseErrorHandlerProvider.getIfAvailable())
                .build();
    }

    @Bean
    @ConditionalOnProperty(name = "spring.ai.model.chat", havingValue = "openai")
    @ConditionalOnMissingBean(ChatModel.class)
    public ChatModel chatModel(
            OpenAiApi openAiApi,
            OpenAiChatProperties chatProperties,
            ToolCallingManager toolCallingManager,
            ObjectProvider<RetryTemplate> retryTemplateProvider,
            ObjectProvider<ObservationRegistry> observationRegistryProvider,
            ObjectProvider<ChatModelObservationConvention> observationConventionProvider) {

        OpenAiChatModel chatModel = OpenAiChatModel.builder()
                .openAiApi(openAiApi)
                .defaultOptions(chatProperties.getOptions())
                .toolCallingManager(toolCallingManager)
                .retryTemplate(retryTemplateProvider.getIfUnique(() -> RetryUtils.DEFAULT_RETRY_TEMPLATE))
                .observationRegistry(observationRegistryProvider.getIfUnique(() -> ObservationRegistry.NOOP))
                .build();

        observationConventionProvider.ifAvailable(chatModel::setObservationConvention);
        return chatModel;
    }

    @Bean
    @Scope("prototype")
    @ConditionalOnBean(ChatModel.class)
    @ConditionalOnMissingBean(ChatClient.Builder.class)
    public ChatClient.Builder chatClientBuilder(ChatModel chatModel) {
        return ChatClient.builder(chatModel);
    }
}
