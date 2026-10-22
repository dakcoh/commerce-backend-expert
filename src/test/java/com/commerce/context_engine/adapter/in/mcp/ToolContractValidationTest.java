package com.commerce.context_engine.adapter.in.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.Arrays;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ToolContractValidationTest {
    @Autowired ToolCallbackProvider provider;
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void publishedSchemaRejectsCoercionMissingAndUnknownFieldsBeforeBinding() throws Exception {
        var search = callback("search_knowledge");
        for (String json : List.of("{}", "{\"query\":[\"결제\",\"웹훅\"]}",
                "{\"query\":\"결제\",\"topK\":\"2\"}", "{\"query\":\"결제\",\"topK\":1.9}",
                "{\"query\":\"결제\",\"topK\":0}", "{\"query\":\"결제\",\"detail\":\"bad\"}",
                "{\"query\":\"결제\",\"responseFormat\":\"bad\"}", "{\"query\":\"결제\",\"unknown\":true}")) {
            assertThatThrownBy(() -> search.call(json)).as(json)
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("arguments", "tools/list");
        }
        assertThat(mapper.readTree(search.call("{\"query\":\" \",\"responseFormat\":\"json\"}")).path("answerable").asBoolean()).isFalse();
        assertThat(mapper.readTree(search.call("{\"query\":\"결제 웹훅\",\"topK\":1}")).path("count").asInt()).isEqualTo(1);
        assertThat(mapper.readTree(search.call("{\"query\":\"결제 웹훅\",\"detail\":\" SUMMARY \",\"responseFormat\":\" JSON \"}")).path("markdown").asText()).isEmpty();
    }

    @Test
    void schemaPublishesOptionsAndResultBounds() throws Exception {
        var search = mapper.readTree(callback("search_knowledge").getToolDefinition().inputSchema()).path("properties");
        assertThat(search.path("topK").path("minimum").asInt()).isEqualTo(1);
        assertThat(search.path("topK").path("maximum").asInt()).isEqualTo(10);
        assertThat(search.path("detail").path("enum").toString()).isEqualTo("[\"summary\",\"full\"]");
        assertThat(search.path("responseFormat").path("enum").toString()).isEqualTo("[\"json\",\"both\"]");
        assertThat(provider.getToolCallbacks()).hasSize(4);
    }

    @Test
    void reviewToolExplainsHowToSupplyTheUserScenario() throws Exception {
        var definition = callback("review_commerce_design").getToolDefinition();
        var properties = mapper.readTree(definition.inputSchema()).path("properties");
        assertThat(definition.description()).contains("사용자가 제공한", "scenario", "추측하지");
        assertThat(properties.path("scenario").path("description").asText())
                .contains("업무·실패", "추측");
    }

    private ToolCallback callback(String name) {
        return Arrays.stream(provider.getToolCallbacks()).filter(callback -> callback.getToolDefinition().name().equals(name)).findFirst().orElseThrow();
    }
}
