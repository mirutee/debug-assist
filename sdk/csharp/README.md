# DebugAssist C# SDK

Auto-capture runtime errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

```bash
dotnet add package DebugAssist
```

## Usage

```csharp
using DebugAssistSDK;

// In Program.cs — one line at the top
DebugAssist.EnsureInitialized();

// Or with explicit key
DebugAssist.Init("your-api-key", "my-project");
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_ASSIST_API_KEY` | Your API key | — |
| `DEBUG_ASSIST_PROJECT` | Project name shown in diagnostics | `unknown` |
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://api.debug-assist.app` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
