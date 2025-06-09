import { LanguageTemplate } from '../types';

export class RustTemplate implements LanguageTemplate {
  language = 'rust' as const;
  fileExtension = 'rs';
  buildCommand = 'cargo build --release';
  runCommand = 'cargo run';

  serverTemplate = `use mcp_sdk::{Server, Tool, ToolResult, Content};
use serde_json::{json, Value};
use std::error::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

// Tool handler modules
{{#tools}}
mod {{snake_case(name)}};
{{/tools}}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Create server
    let mut server = Server::new("{{name}}", "{{version}}");

    // Register tools
    {{#tools}}
    server.register_tool(Tool {
        name: "{{name}}".to_string(),
        description: "{{description}}".to_string(),
        input_schema: json!({{JSON.stringify(inputSchema)}}),
    });
    {{/tools}}

    // Register tool handlers
    {{#tools}}
    server.register_handler("{{name}}", |args| {
        Box::pin(async move {
            {{snake_case(name)}}::handle(args).await
        })
    });
    {{/tools}}

    // Start server on stdio
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut writer = stdout;

    eprintln!("{{name}} MCP server running on stdio");

    server.serve(&mut reader, &mut writer).await?;

    Ok(())
}
`;

  toolTemplate = `use mcp_sdk::{ToolResult, Content};
use serde_json::Value;
use std::error::Error;

/// Handle {{tool.name}} tool
pub async fn handle(args: Value) -> Result<ToolResult, Box<dyn Error>> {
    // TODO: Implement {{tool.name}} tool logic
    
    Ok(ToolResult {
        content: vec![Content::Text {
            text: "{{tool.name}} executed successfully".to_string(),
        }],
    })
}
`;

  testTemplate = `#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_handle_success() {
        let args = json!({
            // TODO: Add test arguments
        });

        let result = handle(args).await;
        
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(!result.content.is_empty());
    }

    #[tokio::test]
    async fn test_handle_error() {
        let args = json!({
            // Invalid arguments
        });

        let result = handle(args).await;
        
        assert!(result.is_err());
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

  packageTemplate = `[package]
name = "{{name}}-mcp-server"
version = "{{version}}"
edition = "2021"

[dependencies]
mcp-sdk = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"

[dev-dependencies]
tokio-test = "0.4"
`;
}