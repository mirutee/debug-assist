# DebugAssist Python SDK

Auto-capture runtime errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

```bash
pip install debug-assist
```

## Usage

```python
# Auto mode — set env var and import
import os
os.environ['DEBUG_ASSIST_API_KEY'] = 'your-api-key'
import debug_assist  # unhandled exceptions are captured automatically

# Explicit mode
from debug_assist import DebugAssist
DebugAssist.init(api_key='your-api-key', project_name='my-app')

# Manual report
client = DebugAssist(api_key='your-api-key')
client.report(tipo='silent_backend_error', mensagem='something went wrong')
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_ASSIST_API_KEY` | Your API key | — |
| `DEBUG_ASSIST_PROJECT` | Project name shown in diagnostics | `unknown` |
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://api.debug-assist.app` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | `1` |
