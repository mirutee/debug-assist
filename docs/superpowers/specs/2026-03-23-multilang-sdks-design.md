# Multi-Language SDKs — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Provide auto-capture SDKs for Java, Go, PHP, Ruby, and C# that match the behavior of the existing Node.js and Python SDKs: minimal setup activates crash monitoring, no other code changes required.

---

## Principle

> Configured API key + minimal setup = crashes appear on the dashboard.

All SDKs share the same contract:
- Auto-initialize when `DEVINSIGHT_API_KEY` env var is set, or when `init()` is called explicitly
- On crash: POST to `/v1/diagnosticos` with `tipo: "silent_backend_error"`, error message, stack trace, exception type, project name
- Never suppress or alter the original crash — only observe it
- After sending, the process must terminate normally (no hanging). Java must call `System.exit(1)` after the handler runs (same pattern as Node.js `process.exit(1)` — the default uncaught exception handler is replaced, so explicit exit is required). In C#, `AppDomain.UnhandledException` is a notification event and the runtime terminates the process automatically — no `Environment.Exit()` needed
- Silently ignore send failures (network errors must not cascade)
- No external dependencies — stdlib HTTP only
- All SDKs respect `DEVINSIGHT_ENABLED=0` to disable in CI/test environments
- HTTP timeout: 10 seconds on all SDKs (balances Render cold start vs. hanging crash handler)

---

## Repository Structure

```
sdk/
  node/           (existing)
  python/         (existing)
  java/
    src/main/java/com/devinsight/DevInsight.java
    pom.xml
  go/
    devinsight.go
    go.mod
  php/
    devinsight.php
  ruby/
    devinsight.rb
  csharp/
    DevInsight.cs
    DevInsight.csproj
```

---

## SDK Specs

### Java (`sdk/java/`)

**Hook:** `Thread.setDefaultUncaughtExceptionHandler()`

**One-liner setup:**
```java
DevInsight.init("SUA_API_KEY", "meu-projeto");
```

Java does not execute static initializers on bare `import` statements, so one explicit call is required. This is the accepted trade-off for the language. When `DEVINSIGHT_API_KEY` env var is set, `init()` can be called without arguments:
```java
DevInsight.init(); // reads DEVINSIGHT_API_KEY from environment
```

**After handler runs:** call `System.exit(1)` to ensure the process terminates (same as Node.js `process.exit(1)` — the default uncaught exception handler is replaced, so explicit exit is required).

**Env vars supported:**
- `DEVINSIGHT_API_KEY` — API key
- `DEVINSIGHT_PROJECT` — project name (default: `"unknown"`)
- `DEVINSIGHT_ENABLED=0` — disables SDK

**HTTP:** `java.net.http.HttpClient` (Java 11+), timeout 10s, no external deps.

**Build:** `pom.xml` with `groupId: com.devinsight`, `artifactId: devinsight`, `version: 1.0.0`, Java 11 target.

---

### Go (`sdk/go/`)

**Hook:** Go has no global panic handler. Panics are captured via `defer recover()` in the entry goroutine.

**Pattern:** `devinsight.Wrap(fn)` — wraps the main function, recovers panics, sends diagnostic, then re-panics (so the original panic stack trace is still printed and the process exits non-zero).

**Note on "auto-init":** Go reads `DEVINSIGHT_API_KEY` at package `init()` time to configure the client, but the developer must still call `Wrap()`. There is no way to intercept panics without a code change in Go — `Wrap()` is the required one-liner.

**Usage:**
```go
import "github.com/devinsight/sdk/go/devinsight"

func main() {
    devinsight.Wrap(run) // one line
}

func run() {
    // your code here
}
```

**Env vars supported:**
- `DEVINSIGHT_API_KEY`
- `DEVINSIGHT_PROJECT` (default: `"unknown"`)
- `DEVINSIGHT_ENABLED=0`

**HTTP:** `net/http` stdlib, timeout 10s, no external deps.

**Module:** `go.mod` with `module github.com/devinsight/sdk/go`, `go 1.21`.

---

### PHP (`sdk/php/`)

**Hook:** `set_exception_handler()` + `register_shutdown_function()` (catches fatal errors too via `error_get_last()`).

**One-liner setup:**
```php
require_once 'devinsight.php'; // só isso
```
Hooks are registered immediately on require. API key from `DEVINSIGHT_API_KEY` env var or `define('DEVINSIGHT_API_KEY', '...')` before require.

**Fatal errors:** `register_shutdown_function` checks `error_get_last()` for `E_ERROR`, `E_PARSE`, `E_CORE_ERROR`, `E_COMPILE_ERROR`.

**Env vars supported:**
- `DEVINSIGHT_API_KEY`
- `DEVINSIGHT_PROJECT` (default: `"unknown"`)
- `DEVINSIGHT_ENABLED=0`

**HTTP:** `file_get_contents()` with stream context (timeout 10s). Falls back to `curl` if `allow_url_fopen` is disabled. No Composer needed.

---

### Ruby (`sdk/ruby/`)

**Hook:** `at_exit` block that checks `$!`. In MRI Ruby (2.7+, 3.x), when the process is exiting due to an unhandled exception, `$!` holds that exception in the `at_exit` callback. This is reliable in MRI Ruby for uncaught exceptions that propagate to the top level. The block guards with `$! && !$!.is_a?(SystemExit)` to skip clean exits and `exit` calls.

**One-liner setup:**
```ruby
require 'devinsight' # só isso
```

**Env vars supported:**
- `DEVINSIGHT_API_KEY`
- `DEVINSIGHT_PROJECT` (default: `"unknown"`)
- `DEVINSIGHT_ENABLED=0`

**HTTP:** `Net::HTTP` stdlib, timeout 10s, no gems needed.

---

### C# (`sdk/csharp/`)

**Hook:**
- `AppDomain.CurrentDomain.UnhandledException` — unhandled exceptions in any thread
- `TaskScheduler.UnobservedTaskException` — unhandled async task exceptions

**How auto-init works:** The static constructor `static DevInsight()` fires on first access to the class. `EnsureInitialized()` is a no-op method whose sole purpose is to trigger that first access. One line in `Program.cs`:
```csharp
DevInsight.EnsureInitialized(); // triggers static constructor → reads DEVINSIGHT_API_KEY
```
Or explicit:
```csharp
DevInsight.Init("SUA_API_KEY", "meu-projeto");
```

**After handler runs:** `AppDomain.UnhandledException` fires but the process terminates regardless in .NET — no explicit `Environment.Exit()` needed. `TaskScheduler.UnobservedTaskException` handler should mark the exception as observed to prevent silent swallowing.

**Env vars supported:**
- `DEVINSIGHT_API_KEY`
- `DEVINSIGHT_PROJECT` (default: `"unknown"`)
- `DEVINSIGHT_ENABLED=0`

**HTTP:** `System.Net.Http.HttpClient`, timeout 10s, no NuGet deps.

**Project:** `DevInsight.csproj` targeting `net6.0`, no external packages.

---

## Payload (all SDKs)

All SDKs send identical payload shape. Field names use `snake_case` consistently (existing Node.js SDK sends `projectName` — this inconsistency is noted but out of scope for this implementation; Node.js SDK alignment is a separate task):

```json
POST /v1/diagnosticos
Authorization: Bearer SUA_API_KEY
Content-Type: application/json

{
  "tipo": "silent_backend_error",
  "mensagem": "<exception message>",
  "contexto": {
    "project_name": "meu-projeto",
    "exception_type": "NullPointerException",
    "stack": "<stack trace string>"
  }
}
```

---

## Documentation Page (`public/docs/sdks.html`)

New page linked from the main `/docs` page and sidebar. Sections:

1. **Overview** — what the SDKs do, one-paragraph intro
2. **Node.js** — npm install + 2-line usage
3. **Python** — pip install + env var or 1-line usage
4. **Java** — Maven dependency + `DevInsight.init()` one-liner
5. **Go** — go get + `devinsight.Wrap(run)` one-liner
6. **PHP** — require + 1-line usage
7. **Ruby** — require + 1-line usage
8. **C#** — NuGet + `DevInsight.EnsureInitialized()` one-liner

Style: matches existing dark theme (`#0d0d0d` background, `#6366f1` accent, `#111` cards). Code blocks use `<pre><code>` monospace blocks with copy-friendly formatting.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `DEVINSIGHT_ENABLED=0` | No hooks registered, SDK is silent |
| API key not set | No hooks registered |
| Network timeout (10s) | Silently ignored — original crash propagates normally |
| API returns error | Silently ignored — original crash propagates normally |
| Handler throws | Wrapped in try/catch — original crash propagates normally |
| Go: non-panic exit | Nothing sent — `Wrap` only catches panics |
| PHP: non-fatal error | Nothing sent — only uncaught exceptions and fatal errors |
| Ruby: clean exit / `exit` call | `$!` is nil or `SystemExit` — nothing sent |
| C#: observed task exception | Nothing sent — only unobserved async exceptions |

---

## Files Summary

| Action | File |
|---|---|
| Create | `sdk/java/src/main/java/com/devinsight/DevInsight.java` |
| Create | `sdk/java/pom.xml` |
| Create | `sdk/go/devinsight.go` |
| Create | `sdk/go/go.mod` |
| Create | `sdk/php/devinsight.php` |
| Create | `sdk/ruby/devinsight.rb` |
| Create | `sdk/csharp/DevInsight.cs` |
| Create | `sdk/csharp/DevInsight.csproj` |
| Create | `public/docs/sdks.html` |
| Modify | `public/docs/index.html` (add SDK link in sidebar/nav) |
| Modify | `swagger.yaml` (add SDK section for all languages) |
