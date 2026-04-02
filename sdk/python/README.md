# DebugAssist Python SDK

Auto-capture runtime errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

```bash
pip install debug-assist
```

## Usage

Set the environment variable and import (unhandled exceptions are captured automatically):

```bash
export DEBUG_ASSIST_API_KEY='your-api-key'
```

```python
import debug_assist  # that's it
```

Or explicitly:

```python
from debug_assist import DebugAssist
DebugAssist.init(api_key='your-api-key', project_name='my-app')
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_ASSIST_API_KEY` | Your API key | — |
| `DEBUG_ASSIST_PROJECT` | Project name shown in diagnostics | `unknown` |
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://debug-assist.onrender.com` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | `1` |
