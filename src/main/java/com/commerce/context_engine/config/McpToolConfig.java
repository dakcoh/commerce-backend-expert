package com.commerce.context_engine.config;

import com.commerce.context_engine.adapter.in.mcp.CommerceKnowledgeTool;
import com.commerce.context_engine.adapter.in.mcp.ValidatedToolCallback;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class McpToolConfig {

    @Bean
    ToolCallbackProvider commerceToolCallbackProvider(CommerceKnowledgeTool commerceKnowledgeTool) {
        ObjectMapper mapper = new ObjectMapper();
        ToolCallback[] callbacks = java.util.Arrays.stream(MethodToolCallbackProvider.builder()
                .toolObjects(commerceKnowledgeTool)
                .build().getToolCallbacks())
                .map(callback -> new ValidatedToolCallback(callback, mapper)).toArray(ToolCallback[]::new);
        return () -> callbacks.clone();
    }
}
