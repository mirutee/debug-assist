# Multi-Language SDKs — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Provide auto-capture SDKs for Java, Go, PHP, Ruby, and C# that match the behavior of the existing Node.js and Python SDKs: one line of import/require activates crash monitoring, no other code changes required.

---

## Principle

> Configured API key + one import = crashes appear on the dashboard.

All SDKs share the same contract:
- Auto-initialize on import/require when `DEVINSIGHT_API_KEY` env var is set (or key is hardcoded)
- On crash: POST to `/v1/diagnosticos` with `tipo: "silent_backend_error"`, error message, stack trace, exception type, project name
- Never suppress or alter the original crash — only observe it
- Silently ignore send failures (network errors must not cascade)
- No external dependencies — stdlib HTTP only

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

**Auto-init:** Static initializer block reads `DEVINSIGHT_API_KEY` env var. If set, registers handler immediately on class load.

**Usage:**
```java
// Option 1: env var DEVINSIGHT_API_KEY set → just import and touch the class
import com.devinsight.DevInsight;
static { DevInsight.class.getName(); } // triggers static init

// Option 2: explicit
DevInsight.init("SUA_API_KEY", "meu-projeto");
```

**HTTP:** `java.net.http.HttpClient` (Java 11+), no external deps.

**Build:** `pom.xml` with `groupId: com.devinsight`, `artifactId: devinsight`, `version: 1.0.0`, Java 11 target.

---

### Go (`sdk/go/`)

**Hook:** Go has no global panic handler. Panics are captured via `defer recover()` in the entry goroutine.

**Pattern:** `devinsight.Wrap(fn)` — wraps the main function, recovers panics, sends diagnostic, re-panics.

**Auto-init:** `DEVINSIGHT_API_KEY` env var read at package init time.

**Usage:**
```go
import "github.com/devinsight/sdk/go/devinsight"

func main() {
    devinsight.Wrap(run)
}

func run() {
    // your code here
}
```

**HTTP:** `net/http` stdlib, no external deps.

**Module:** `go.mod` with `module github.com/devinsight/sdk/go`, `go 1.21`.

---

### PHP (`sdk/php/`)

**Hook:** `set_exception_handler()` + `register_shutdown_function()` (catches fatal errors too).

**Auto-init:** Registers hooks immediately on `require 'devinsight.php'`. API key from `DEVINSIGHT_API_KEY` env var or `define('DEVINSIGHT_API_KEY', '...')` before require.

**Usage:**
```php
require_once 'devinsight.php'; // só isso
```

**HTTP:** `file_get_contents()` with stream context, or `curl` if available. No Composer needed.

**Fatal errors:** `register_shutdown_function` checks `error_get_last()` for fatal errors (E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR).

---

### Ruby (`sdk/ruby/`)

**Hook:** `at_exit { send_if_crash($!) }` — `$!` holds the exception that caused exit, nil on clean exit.

**Auto-init:** Registers hook on `require 'devinsight'`. API key from `DEVINSIGHT_API_KEY` env var or `Devinsight.api_key = '...'` before require.

**Usage:**
```ruby
require 'devinsight' # só isso
```

**HTTP:** `Net::HTTP` stdlib, no gems needed.

---

### C# (`sdk/csharp/`)

**Hook:**
- `AppDomain.CurrentDomain.UnhandledException` — unhandled exceptions in any thread
- `TaskScheduler.UnobservedTaskException` — unhandled async task exceptions

**Auto-init:** `DevInsight.Init()` called from `static DevInsight()` constructor if `DEVINSIGHT_API_KEY` env var is set.

**Usage:**
```csharp
// Option 1: env var DEVINSIGHT_API_KEY set
using DevInsightSDK;
DevInsight.EnsureInitialized(); // one line in Program.cs

// Option 2: explicit
DevInsight.Init("SUA_API_KEY", "meu-projeto");
```

**HTTP:** `System.Net.Http.HttpClient`, no NuGet deps.

**Project:** `DevInsight.csproj` targeting `net6.0`, no external packages.

---

## Payload (all SDKs)

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
3. **Python** — pip install + 1-line usage (env var approach)
4. **Java** — Maven dependency + 1-line usage
5. **Go** — go get + Wrap pattern
6. **PHP** — require + 1-line usage
7. **Ruby** — require + 1-line usage
8. **C#** — NuGet + 1-line usage

Style: matches existing dashboard dark theme (`#0d0d0d` background, `#6366f1` accent). Code blocks use monospace with syntax highlighting via inline `<pre><code>`.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| API key not set | SDK does nothing — no hooks registered |
| Network timeout | Silently ignored — original crash propagates normally |
| API returns error | Silently ignored — original crash propagates normally |
| Hook throws | Wrapped in try/catch — original crash propagates normally |
| Go: non-panic exit | Nothing sent — `Wrap` only catches panics |
| PHP: non-fatal error | Nothing sent — only uncaught exceptions and fatal errors |

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
| Modify | `public/docs/index.html` (add SDK link) |
| Modify | `swagger.yaml` (add SDK section for all languages) |
