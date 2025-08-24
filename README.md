# 🔌 Composio Plugin for ElizaOS

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ElizaOS Compatible](https://img.shields.io/badge/ElizaOS-Compatible-green.svg)](https://github.com/elizaOS/eliza)
[![Version](https://img.shields.io/badge/version-1.2.21-blue.svg)](https://github.com/standujar/plugin-composio/releases/tag/v1.2.21)

A powerful ElizaOS plugin that integrates **250+ external tool integrations** through [Composio](https://composio.dev). Enable your AI agent to interact with GitHub, Slack, Linear, Google Drive, Notion, and hundreds more services through natural language.

[Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Usage](#usage) • [API Reference](#api-reference) • [Contributing](#contributing)

</div>

## ✨ Features

- 🔗 **250+ Integrations**: Connect to popular services like GitHub, Slack, Linear, Google Workspace, Notion, Jira, and more
- 🤖 **AI-Powered Tool Selection**: Intelligent semantic search finds the right tools based on natural language requests
- 🔐 **Secure Authentication**: OAuth and API key management handled by Composio
- 🚀 **Zero Configuration**: Works out of the box with connected apps
- 📝 **Vercel AI SDK Integration**: Seamless integration with ElizaOS's function calling
- ⚡ **Smart Workflow Generation**: Automatically creates multi-step workflows from user requests
- 🎯 **Context-Aware**: Understands conversation context for better tool selection
- 📊 **Results Provider**: Stores execution results for reuse in subsequent actions
- 🧠 **Intelligent Dependency Resolution**: Only fetches missing data, avoids redundant API calls
- ⚙️ **Smart Context Analysis**: Detects when IDs or data are already available in conversation

## 📦 Installation

```bash
# Using bun (recommended)
bun add @standujar/plugin-composio

# Using npm
npm install @standujar/plugin-composio

# Using yarn
yarn add @standujar/plugin-composio
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required: Composio API Key
COMPOSIO_API_KEY=your_composio_api_key

# Optional: Default user ID (default: "default")
COMPOSIO_DEFAULT_USER_ID=your_user_id

# Optional: Multi-user mode (default: false)
COMPOSIO_MULTI_USER_MODE=false               # false: single user with default ID, true: per-message user ID

# Optional: Fine-tuning parameters
COMPOSIO_TOOLKIT_EXTRACTION_TEMPERATURE=0.7              # Toolkit & use case extraction (default: 0.7)
COMPOSIO_TOOL_EXECUTION_TEMPERATURE=0.5                  # Tool execution workflow (default: 0.5)
COMPOSIO_TOOLKIT_CONNECTION_EXTRACTION_TEMPERATURE=0.3   # Toolkit name extraction (default: 0.3)
COMPOSIO_TOOLKIT_CONNECTION_RESPONSE_TEMPERATURE=0.7     # Connection response formatting (default: 0.7)
COMPOSIO_TOOLKIT_REMOVAL_RESPONSE_TEMPERATURE=0.7        # Disconnection response formatting (default: 0.7)
```

### Character Configuration

Add the plugin to your ElizaOS character configuration:

```json
{
  "name": "MyAssistant",
  "plugins": ["@standujar/plugin-composio"],
  "settings": {
    "COMPOSIO_MULTI_USER_MODE": "{{COMPOSIO_MULTI_USER_MODE}}",
    "secrets": {
      "COMPOSIO_API_KEY": "{{COMPOSIO_API_KEY}}",
      "COMPOSIO_DEFAULT_USER_ID": "{{COMPOSIO_DEFAULT_USER_ID}}"

    }
  }
}
```

### User Modes

The plugin supports two user modes:

#### 🧑‍💼 **Single User Mode** (default: `COMPOSIO_MULTI_USER_MODE=false`)
- Uses the same user ID for all requests (`COMPOSIO_DEFAULT_USER_ID`)
- All users share the same connected apps and data
- Simpler setup, good for personal use or single-tenant scenarios

#### 👥 **Multi-User Mode** (`COMPOSIO_MULTI_USER_MODE=true`)
- Each message sender gets their own user ID (`message.entityId`)
- Isolated app connections and data per user
- Required for multi-tenant applications
- Each user must connect their own apps

### Getting Started with Composio

1. **Sign up** at [Composio](https://composio.dev)
2. **Generate an API key** from your dashboard
3. **Connect your apps** - Follow the [Quickstart Guide](https://docs.composio.dev/getting-started/quickstart)
4. **Add the API key** to your environment

📚 **Documentation**:
- [Welcome Guide](https://docs.composio.dev/getting-started/welcome)
- [Installation](https://docs.composio.dev/getting-started/installation)
- [Full Documentation](https://docs.composio.dev/)

## 🎯 Usage

The plugin provides **4 main actions** to interact with Composio integrations:

### 🔧 Available Actions

#### 1. **Tool Execution** (`executeToolsAction`)
Execute workflows using connected apps based on natural language requests:

```
User: "Create a new issue in Linear and assign it to John"
Assistant: ✅ Created issue LIN-123 in Backend project, assigned to John
```

#### 2. **Connect Apps** (`connectToolkitAction`)
Connect new integrations to your account:

```
User: "Connect Gmail to my composio account"
Assistant: Gmail connection initiated! Please authorize at: [auth-link]
```

#### 3. **List Connected Apps** (`listConnectedToolkitsAction`)
View all your connected integrations:

```
User: "What apps are my composio connected toolkit?"
Assistant: Your connected apps: Gmail, Slack, Linear, GitHub (4 total)
```

#### 4. **Disconnect Apps** (`disconnectToolkitAction`)
Remove app connections:

```
User: "Remove Slack composio integration"
Assistant: ✅ Slack has been disconnected successfully
```

### Example Interactions

#### 📊 Linear Integration - Smart Dependency Resolution

```
User: Create a new issue in Linear for the project "Backend" and assign it to Alice using composio

[Workflow Analysis]
1. Extract: "Create issue" (linear)
2. Dependencies detected: Need project_id and user_id
3. Combined use case: "List projects and search users. Then, Create issue"

Assistant: I'll create a new issue in Linear. Let me find the project and user first.

✅ Created issue successfully:
- Title: "New task"
- ID: LIN-123  
- Project: Backend
- Assigned to: Alice
- Status: Backlog
- URL: https://linear.app/team/issue/LIN-123
```

#### 🚀 Optimized Workflow - No Dependencies Needed

```
User: Delete issue USEK-162

[Workflow Analysis]
1. Extract: "Delete issue" (linear)
2. Dependencies: None (ID already provided)
3. Final use case: "Delete issue"

Assistant: I'll delete issue USEK-162 for you.

✅ Issue USEK-162 has been successfully archived.
```

#### 💬 Slack Integration - Single Response Mode

```
User: Send a summary of today's standup notes to the team channel
Assistant: I've sent the standup summary to your team channel.

✅ Message posted to #team-standup:
"Daily Standup Summary - January 20
- John: Completed authentication module, starting on API tests
- Sarah: Fixed memory leak issue, reviewing PR #44
- Mike: Updated documentation, working on search optimization
- Blockers: Need design review for dark mode feature"

The message was sent with mentions for all 12 team members.
```

### How Tool Execution Works

```mermaid
graph TD
    A[User Request] --> B[Extract Toolkit & Use Case]
    B --> C[Check Connected Apps]
    C --> D[COMPOSIO_SEARCH_TOOLS]
    D --> E[Get Dependency Graph]
    E --> F[Include ALL Dependencies]
    F --> G[Fetch Tools from SDK]
    G --> H[Execute with LLM]
    H --> I[Store Successful Results]
    I --> J[Natural Language Response]
    
    style A fill:#e1f5fe
    style J fill:#c8e6c9
    style I fill:#fff3e0
```

### Key Features

- 🎯 **Smart Toolkit Detection** - Automatically identifies the right app from user request
- 🔗 **Dependency Resolution** - Includes ALL tool dependencies, lets LLM create intelligent workflows  
- 📊 **Results Provider** - Stores successful execution results for context in future actions
- 🔄 **Multi-User Support** - Works in both single-user and multi-user modes
- ⚡ **Simplified Logic** - Removed complex filtering, improved LLM decision making
- 🛡️ **Error Handling** - Retry logic for 500 errors, proper error reporting


## 🛠️ Technical Details

### Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant P as Plugin
    participant R as Results Provider
    participant C as Composio API
    participant T as Tools (GitHub/Slack/etc)
    
    U->>P: Natural language request
    P->>P: Extract toolkit & use case
    P->>R: Get previous executions
    R-->>P: Relevant execution history
    P->>C: COMPOSIO_SEARCH_TOOLS
    C-->>P: Main tool + dependencies
    P->>C: Get ALL dependency tools
    C-->>P: Complete tool collection
    P->>T: Execute with LLM + tools
    T-->>P: Tool execution results
    P->>R: Store successful results only
    P->>U: Natural language response
```

### Key Components

- **ComposioService**: Manages Composio client and tool execution
- **ComposioResultsProvider**: Persistent storage for tool execution results
  - Stores up to 5 executions per toolkit
  - Enables context-aware subsequent actions
  - Automatically filters successful results
  - Provides execution history for dependency resolution
- **Actions**:
  - `executeToolsAction`: Main action handler with intelligent dependency resolution
  - `connectToolkitAction`: Connect new apps and integrations
  - `disconnectToolkitAction`: Remove app connections
  - `listConnectedToolkitsAction`: Show connected apps and services
- **Optimized Templates**:
  - `toolExecutionPrompt`: Minimal execution prompt with workflow guidance
  - `toolkitUseCaseExtractionPrompt`: Verb + action extraction
  - `toolkitNameExtractionPrompt`: Extract toolkit names from user messages
  - `toolkitConnectionResponsePrompt`: Format connection responses
  - `toolkitDisconnectionResponsePrompt`: Format disconnection responses
- **Context-Aware Analysis**: Avoids fetching data already in conversation
- **Smart Use Case Combination**: Dependencies execute before main actions

## 🔍 Debugging

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug bun start
```

Common debug points:
- Workflow extraction (verb + action format)
- Dependency analysis (what data is missing vs available)
- Use case combination (dependencies + main action)
- Tool search results from COMPOSIO_SEARCH_TOOLS
- Context analysis for avoiding redundant fetches

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/standujar/plugin-composio.git

# Install dependencies
bun install

# Run tests
bun test

# Build the plugin
bun run build

# Run in development mode
bun run dev
```

### Code Style

- TypeScript with strict mode
- ESLint and Prettier for formatting
- JSDoc comments for all public APIs
- Comprehensive error handling

## 📄 License

This plugin is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Composio Docs](https://docs.composio.dev)
- **ElizaOS**: [ElizaOS GitHub](https://github.com/elizaOS/eliza)
- **Issues**: [GitHub Issues](https://github.com/standujar/plugin-composio/issues)
- **Discord**: Join the ElizaOS Discord community

## 📈 Roadmap

- [x] **Connect new Apps from Action** - ✅ Available via `connectToolkitAction`
- [x] **List Connected Apps from Action** - ✅ Available via `listConnectedToolkitsAction`
- [x] **Disconnect Apps from Action** - ✅ Available via `disconnectToolkitAction`
- [ ] Composio Trigger creation from Action
- [ ] Upgrade to latest composio core supporting ai sdk 5

---

<div align="center">
Made with ❤️ by the ElizaOS community
</div>