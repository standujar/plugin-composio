# Composio Plugin for ElizaOS

A powerful ElizaOS plugin that integrates **250+ external tool integrations** through [Composio](https://composio.dev). This plugin enables your Eliza agent to interact with tools like GitHub, Slack, Google Drive, Notion, and many more directly through natural language.

## Features

- 🔗 **250+ Integrations**: Access to GitHub, Slack, Google Workspace, Notion, Jira, and more
- 🤖 **AI-Driven Tool Selection**: Automatically chooses the right tools based on user requests
- 🔐 **Secure Authentication**: Handles OAuth and API key management through Composio
- 🚀 **Easy Integration**: Seamlessly works with Eliza's core tool system
- 📝 **Function Calling**: Uses Eliza's enhanced function calling capabilities

## Installation

1. Install the plugin:
```bash
bun add @standujar/plugin-composio
```

2. Add to your Eliza character configuration:
```json
{
  "plugins": ["@standujar/plugin-composio"]
}
```

## Configuration

### Required Environment Variables

```bash
# Composio API Key (required)
COMPOSIO_API_KEY=your_composio_api_key

# Optional: User ID for multi-user scenarios
COMPOSIO_USER_ID=default
```

### Getting Your Composio API Key

1. Sign up at [Composio](https://composio.dev)
2. Generate an API key from your dashboard
3. Connect the apps you want to use (GitHub, Slack, etc.)

### Character Configuration Example

```json
{
  "name": "Assistant",
  "plugins": ["@standujar/plugin-composio"],
  "modelProvider": "openrouter",
  "settings": {
    "secrets": {
      "COMPOSIO_API_KEY": "your_api_key_here"
    }
  }
}
```

## Usage

Once configured, your Eliza agent can automatically use Composio tools. Here are some example interactions:

### GitHub Integration
```
User: "Create a new repository called 'my-project' on GitHub"
Assistant: I'll create a new GitHub repository for you...
[Uses GITHUB_CREATE_REPO tool automatically]
```

### Slack Integration
```
User: "Send a message to the #general channel saying 'Hello team!'"
Assistant: I'll send that message to the Slack channel...
[Uses SLACK_SEND_MESSAGE tool automatically]
```

### Google Drive Integration
```
User: "List all files in my Google Drive"
Assistant: Let me fetch your Google Drive files...
[Uses GOOGLEDRIVE_LIST_FILES tool automatically]
```

## How It Works

1. **Tool Discovery**: The plugin automatically fetches available tools from Composio based on your connected apps
2. **Smart Selection**: When you make a request, Eliza's AI model automatically selects the appropriate Composio tools
3. **Execution**: The selected tools are executed through Composio's secure API
4. **Response**: Results are processed and returned as natural language responses

## Supported Integrations

The plugin supports all Composio integrations, including:

- **Development**: GitHub, GitLab, Jira, Linear
- **Communication**: Slack, Discord, Microsoft Teams
- **Productivity**: Google Workspace, Microsoft 365, Notion
- **Storage**: Google Drive, Dropbox, OneDrive
- **Marketing**: Mailchimp, HubSpot, Salesforce
- **And 200+ more...

## Development

```bash
# Start development with hot-reloading
bun run dev

# Build the plugin
bun run build

# Test the plugin
bun run test
```

### Custom User ID

For multi-user scenarios, you can set different user IDs:

```bash
COMPOSIO_USER_ID=user_123
```

## Troubleshooting

### Common Issues

1. **"No tools available"**: Ensure you have connected apps in your Composio dashboard
2. **Authentication errors**: Check your API key and app connections
3. **Tool execution fails**: Verify app permissions and connection status

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

This plugin is licensed under the same license as ElizaOS.

## Support

- [Composio Documentation](https://docs.composio.dev)
- [ElizaOS Documentation](https://github.com/elizaOS/eliza)
- [GitHub Issues](https://github.com/standujar/plugin-composio/issues)
