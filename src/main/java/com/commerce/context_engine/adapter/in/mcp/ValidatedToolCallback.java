package com.commerce.context_engine.adapter.in.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import com.commerce.context_engine.core.model.SearchQuery;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

/** Validate the published contract before Spring's method binder can coerce input types. */
public final class ValidatedToolCallback implements ToolCallback {
    private final ToolCallback delegate;
    private final ToolDefinition definition;
    private final Schema schema;
    private final ObjectMapper mapper;

    public ValidatedToolCallback(ToolCallback delegate, ObjectMapper mapper) {
        this.delegate = delegate;
        this.mapper = mapper;
        try {
            ObjectNode json = (ObjectNode) mapper.readTree(delegate.getToolDefinition().inputSchema());
            ObjectNode properties = (ObjectNode) json.get("properties");
            for (String name : List.of("topK", "maxFindings")) {
                if (properties.has(name)) ((ObjectNode) properties.get(name)).put("minimum", 1).put("maximum", SearchQuery.MAX_TOP_K);
            }
            choices(properties, "detail", List.of("summary", "full"));
            choices(properties, "artifactType", List.of("design", "api", "ddl", "code"));
            choices(properties, "responseFormat", List.of("json", "both"));
            definition = ToolDefinition.builder().name(delegate.getToolDefinition().name())
                    .description(delegate.getToolDefinition().description()).inputSchema(mapper.writeValueAsString(json)).build();
            schema = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12).getSchema(definition.inputSchema());
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot build tool input contract", exception);
        }
    }

    private static void choices(ObjectNode properties, String name, List<String> values) {
        if (properties.has(name)) {
            var choices = ((ObjectNode) properties.get(name)).putArray("enum");
            values.forEach(choices::add);
        }
    }

    @Override public ToolDefinition getToolDefinition() { return definition; }
    @Override public ToolMetadata getToolMetadata() { return delegate.getToolMetadata(); }
    @Override public String call(String input) { return call(input, null); }

    @Override public String call(String input, ToolContext context) {
        com.fasterxml.jackson.databind.JsonNode parameters;
        try {
            parameters = mapper.readTree(input);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Tool arguments must be valid JSON");
        }
        if (parameters instanceof ObjectNode object) {
            for (String name : List.of("detail", "artifactType", "responseFormat")) {
                if (object.path(name).isTextual()) {
                    String value = object.get(name).asText().trim().toLowerCase(java.util.Locale.ROOT);
                    if (value.isEmpty()) object.remove(name);
                    else object.put(name, value);
                }
            }
        }
        var errors = schema.validate(parameters);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Invalid " + definition.name() + " arguments: "
                    + errors.stream().limit(3).map(error -> error.getInstanceLocation() + ": " + error.getMessage()).collect(Collectors.joining("; "))
                    + ". Follow tools/list: query/artifact must be strings, counts integers 1~10; omit optional filters if unknown.");
        }
        return delegate.call(parameters.toString(), context);
    }
}
