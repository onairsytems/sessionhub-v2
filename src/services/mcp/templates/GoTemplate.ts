import { LanguageTemplate } from '../types';

export class GoTemplate implements LanguageTemplate {
  language = 'go' as const;
  fileExtension = 'go';
  buildCommand = 'go build -o mcp-server';
  runCommand = './mcp-server';

  serverTemplate = `package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/modelcontextprotocol/go-sdk/pkg/server"
	"github.com/modelcontextprotocol/go-sdk/pkg/types"
)

// Tool handlers
{{#tools}}
func handle{{toPascalCase(name)}}(args map[string]interface{}) (*types.ToolResult, error) {
	// TODO: Implement {{name}} tool logic
	return &types.ToolResult{
		Content: []types.Content{
			{
				Type: "text",
				Text: "{{name}} executed successfully",
			},
		},
	}, nil
}
{{/tools}}

func main() {
	// Create server
	srv := server.NewServer(server.Config{
		Name:    "{{name}}",
		Version: "{{version}}",
	})

	// Register tools
	tools := []types.Tool{
		{{#tools}}
		{
			Name:        "{{name}}",
			Description: "{{description}}",
			InputSchema: json.RawMessage(\`{{JSON.stringify(inputSchema)}}\`),
		},
		{{/tools}}
	}

	srv.RegisterTools(tools)

	// Register tool handlers
	{{#tools}}
	srv.RegisterToolHandler("{{name}}", handle{{toPascalCase(name)}})
	{{/tools}}

	// Start server
	log.Printf("Starting {{name}} MCP server...")
	
	reader := bufio.NewReader(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)
	
	if err := srv.Serve(reader, writer); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
`;

  toolTemplate = `package tools

import (
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/pkg/types"
)

// Handle{{toPascalCase(tool.name)}} handles the {{tool.name}} tool
func Handle{{toPascalCase(tool.name)}}(args map[string]interface{}) (*types.ToolResult, error) {
	// TODO: Implement {{tool.name}} tool logic
	
	return &types.ToolResult{
		Content: []types.Content{
			{
				Type: "text",
				Text: "{{tool.name}} executed successfully",
			},
		},
	}, nil
}
`;

  testTemplate = `package tools_test

import (
	"testing"

	"{{module}}/tools"
)

func TestHandle{{toPascalCase(tool.name)}}(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		wantErr bool
	}{
		{
			name: "successful execution",
			args: map[string]interface{}{
				// TODO: Add test arguments
			},
			wantErr: false,
		},
		{
			name: "error case",
			args: map[string]interface{}{
				// Invalid arguments
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := tools.Handle{{toPascalCase(tool.name)}}(tt.args)
			
			if (err != nil) != tt.wantErr {
				t.Errorf("Handle{{toPascalCase(tool.name)}}() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			
			if !tt.wantErr && result == nil {
				t.Error("Handle{{toPascalCase(tool.name)}}() returned nil result")
			}
		})
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

  packageTemplate = `module {{name}}-mcp-server

go 1.21

require (
	github.com/modelcontextprotocol/go-sdk v0.1.0
)
`;
}