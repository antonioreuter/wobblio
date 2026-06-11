# MCP Servers Setup Guide

Model Context Protocol (MCP) servers enable the AI development assistant to directly interact with your local and cloud infrastructure. Here is how to configure them in your IDE settings.

---

## 1. PostgreSQL MCP Server
Allows the agent to view tables, check Row-Level Security (RLS) policies, and query local and dev database states.

### Configuration
Add this to your IDE's `mcp_config.json`:
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://dev_user:dev_password@localhost:5432/invoice_comparator_dev"
      ]
    }
  }
}
```

---

## 2. AWS Logs MCP Server
Allows the agent to scan CloudWatch execution logs for the SQS-triggered worker Lambda and debug extraction errors.

### Configuration
```json
{
  "mcpServers": {
    "aws-logs": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-aws-logs"
      ],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_PROFILE": "invoice-comparator-dev"
      }
    }
  }
}
```

---

## 3. Google Stitch MCP Server
Allows the agent to create and manage the Wobblio design system, generate screen wireframes from text prompts, and edit screens — replacing the need for a manual Figma workflow.

Stitch is available as a **built-in MCP server** in Claude Code and requires no separate token or `mcpServers` configuration entry. The tools are available directly as `mcp__stitch__*` (e.g. `create_design_system`, `generate_screen_from_text`, `edit_screens`, `list_projects`).

> No additional configuration needed — ensure you are running Claude Code with the Stitch plugin enabled.

---

## 4. GitHub MCP Server
Allows the agent to manage monorepo pull requests, review GitHub Action workflows, and create issues.

### Configuration
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token"
      }
    }
  }
}
```
