# DebugAssist Ruby SDK

Auto-capture runtime errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

```bash
gem install debug-assist
```

Or in your Gemfile:

```ruby
gem 'debug-assist'
```

## Usage

```ruby
require 'debug_assist'
# unhandled exceptions are captured automatically via at_exit hook
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_ASSIST_API_KEY` | Your API key | — |
| `DEBUG_ASSIST_PROJECT` | Project name shown in diagnostics | `unknown` |
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://debug-assist.onrender.com` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
