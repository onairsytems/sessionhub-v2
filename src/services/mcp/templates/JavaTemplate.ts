import { LanguageTemplate } from '../types';

export class JavaTemplate implements LanguageTemplate {
  language = 'java' as const;
  fileExtension = 'java';
  buildCommand = 'mvn clean package';
  runCommand = 'java -jar target/mcp-server.jar';

  serverTemplate = `package com.sessionhub.mcp;

import com.modelcontextprotocol.sdk.MCPServer;
import com.modelcontextprotocol.sdk.Tool;
import com.modelcontextprotocol.sdk.ToolResult;
import com.modelcontextprotocol.sdk.Content;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.util.*;
import java.util.logging.Logger;

{{#tools}}
import com.sessionhub.mcp.tools.{{toPascalCase(name)}}Handler;
{{/tools}}

public class MCPServerMain {
    private static final Logger logger = Logger.getLogger(MCPServerMain.class.getName());
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static void main(String[] args) {
        try {
            // Create server
            MCPServer server = new MCPServer("{{name}}", "{{version}}");

            // Register tools
            {{#tools}}
            server.registerTool(new Tool(
                "{{name}}",
                "{{description}}",
                objectMapper.readTree("{{JSON.stringify(inputSchema)}}")
            ));
            {{/tools}}

            // Register tool handlers
            {{#tools}}
            server.registerHandler("{{name}}", new {{toPascalCase(name)}}Handler());
            {{/tools}}

            // Start server on stdio
            logger.info("Starting {{name}} MCP server on stdio...");
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
            PrintWriter writer = new PrintWriter(System.out, true);
            
            server.serve(reader, writer);
            
        } catch (Exception e) {
            logger.severe("Server error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
`;

  toolTemplate = `package com.sessionhub.mcp.tools;

import com.modelcontextprotocol.sdk.ToolHandler;
import com.modelcontextprotocol.sdk.ToolResult;
import com.modelcontextprotocol.sdk.Content;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;

public class {{toPascalCase(tool.name)}}Handler implements ToolHandler {
    
    @Override
    public ToolResult handle(JsonNode arguments) throws Exception {
        // TODO: Implement {{tool.name}} tool logic
        
        List<Content> contents = new ArrayList<>();
        contents.add(new Content.TextContent("{{tool.name}} executed successfully"));
        
        return new ToolResult(contents);
    }
}
`;

  testTemplate = `package com.sessionhub.mcp.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.modelcontextprotocol.sdk.ToolResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class {{toPascalCase(tool.name)}}HandlerTest {
    
    private {{toPascalCase(tool.name)}}Handler handler;
    private ObjectMapper objectMapper;
    
    @BeforeEach
    void setUp() {
        handler = new {{toPascalCase(tool.name)}}Handler();
        objectMapper = new ObjectMapper();
    }
    
    @Test
    void testHandleSuccess() throws Exception {
        // Arrange
        ObjectNode args = objectMapper.createObjectNode();
        // TODO: Add test arguments
        
        // Act
        ToolResult result = handler.handle(args);
        
        // Assert
        assertNotNull(result);
        assertFalse(result.getContents().isEmpty());
    }
    
    @Test
    void testHandleError() {
        // Arrange
        ObjectNode args = objectMapper.createObjectNode();
        // Invalid arguments
        
        // Act & Assert
        assertThrows(Exception.class, () -> handler.handle(args));
    }
}
`;

  configTemplate = `{
  "name": "{{name}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "tools": {{JSON.stringify(tools, null, 2)}},
  "integrations": {{JSON.stringify(integrations, null, 2)}}
}
`;

  packageTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.sessionhub.mcp</groupId>
    <artifactId>{{name}}-mcp-server</artifactId>
    <version>{{version}}</version>
    <packaging>jar</packaging>

    <name>{{name}} MCP Server</name>
    <description>{{description}}</description>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.modelcontextprotocol</groupId>
            <artifactId>mcp-sdk-java</artifactId>
            <version>0.1.0</version>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.15.2</version>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.9.3</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.4.1</version>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals>
                            <goal>shade</goal>
                        </goals>
                        <configuration>
                            <finalName>mcp-server</finalName>
                            <transformers>
                                <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
                                    <mainClass>com.sessionhub.mcp.MCPServerMain</mainClass>
                                </transformer>
                            </transformers>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
`;
}