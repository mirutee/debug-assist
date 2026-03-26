# DebugAssist Go SDK

Auto-capture panics and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

```bash
go get github.com/debug-assist/sdk-go
```

## Usage

```go
import "github.com/debug-assist/sdk-go"

func main() {
    debugassist.Wrap(run)
}

func run() {
    // your app code — panics are captured and reported automatically
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_ASSIST_API_KEY` | Your API key | — |
| `DEBUG_ASSIST_PROJECT` | Project name shown in diagnostics | `unknown` |
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://api.debug-assist.app` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
