# DebugAssist Java SDK

Auto-capture runtime errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install (Maven)

```xml
<dependency>
    <groupId>io.github.debug-assist</groupId>
    <artifactId>debug-assist</artifactId>
    <version>1.0.0</version>
</dependency>
```

## Install (Gradle)

```groovy
implementation 'io.github.debug-assist:debug-assist:1.0.0'
```

## Usage

```java
import io.github.debugassist.DebugAssist;

public class Main {
    public static void main(String[] args) {
        DebugAssist.init(); // reads DEBUG_ASSIST_API_KEY from env
        // your app code
    }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_ASSIST_API_KEY` | Your API key | — |
| `DEBUG_ASSIST_PROJECT` | Project name shown in diagnostics | `unknown` |
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://debug-assist.onrender.com` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
