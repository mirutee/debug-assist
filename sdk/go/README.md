# DebugAssist Go SDK

Auto-capture panics and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

```bash
go get github.com/mirutee/debug-assist/sdk/go
```

## Usage

```go
import debugassist "github.com/mirutee/debug-assist/sdk/go"

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
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://debugassist.com.br` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
