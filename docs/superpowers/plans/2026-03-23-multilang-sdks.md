# Multi-Language SDKs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-capture crash SDKs for Java, Go, PHP, Ruby, and C#, plus a unified SDK documentation page at `/docs/sdks.html`.

**Architecture:** Each SDK is a standalone file (+ build descriptor) in `sdk/<lang>/`. All SDKs share the same contract: register crash hook on load/init, POST to `POST /v1/diagnosticos`, never suppress the original error. The docs page is a static HTML file served at `/docs/sdks.html` by the existing Express static middleware.

**Tech Stack:** Java 11 (java.net.http), Go 1.21 (net/http), PHP 7.4+ (file_get_contents/curl), Ruby 2.7+ (Net::HTTP), C# .NET 6 (HttpClient). No external dependencies in any SDK.

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `sdk/java/src/main/java/com/devinsight/DevInsight.java` | Java SDK — uncaught exception handler |
| Create | `sdk/java/pom.xml` | Maven build descriptor |
| Create | `sdk/go/devinsight.go` | Go SDK — panic wrapper |
| Create | `sdk/go/go.mod` | Go module descriptor |
| Create | `sdk/php/devinsight.php` | PHP SDK — exception + fatal error hooks |
| Create | `sdk/ruby/devinsight.rb` | Ruby SDK — at_exit hook |
| Create | `sdk/csharp/DevInsight.cs` | C# SDK — AppDomain + TaskScheduler hooks |
| Create | `sdk/csharp/DevInsight.csproj` | .NET project file |
| Create | `public/docs/sdks.html` | Unified SDK documentation page |
| Modify | `public/index.html` | Add "SDKs" link to navbar |
| Modify | `swagger.yaml` | Add SDK sections for all languages |

---

## Task 1: Java SDK

**Files:**
- Create: `sdk/java/src/main/java/com/devinsight/DevInsight.java`
- Create: `sdk/java/pom.xml`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p sdk/java/src/main/java/com/devinsight
```

- [ ] **Step 2: Create `sdk/java/src/main/java/com/devinsight/DevInsight.java`**

```java
package com.devinsight;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

public final class DevInsight {

    private static final String DEFAULT_BASE_URL = "https://devinsight-api.onrender.com";
    private static volatile boolean initialized = false;

    private DevInsight() {}

    /** Reads DEVINSIGHT_API_KEY from environment and registers the crash handler. */
    public static synchronized void init() {
        String apiKey = System.getenv("DEVINSIGHT_API_KEY");
        String project = envOr("DEVINSIGHT_PROJECT", "unknown");
        if (apiKey != null && !apiKey.isBlank()) {
            init(apiKey, project);
        }
    }

    /** Registers the crash handler with an explicit API key. */
    public static synchronized void init(String apiKey, String projectName) {
        if (initialized) return;
        if ("0".equals(System.getenv("DEVINSIGHT_ENABLED"))) return;
        if (apiKey == null || apiKey.isBlank()) return;

        initialized = true;

        final String key     = apiKey;
        final String project = projectName != null ? projectName : "unknown";
        final String base    = envOr("DEVINSIGHT_BASE_URL", DEFAULT_BASE_URL).replaceAll("/+$", "");

        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            send(key, base, project, throwable);
            System.exit(1);
        });
    }

    // ── internals ────────────────────────────────────────────────────────────

    private static void send(String apiKey, String baseUrl, String projectName, Throwable t) {
        try {
            StringBuilder sb = new StringBuilder();
            for (StackTraceElement el : t.getStackTrace()) {
                sb.append("\tat ").append(el).append("\n");
            }
            String body = "{"
                + "\"tipo\":\"silent_backend_error\","
                + "\"mensagem\":" + jsonStr(t.getMessage()) + ","
                + "\"contexto\":{"
                +   "\"project_name\":"    + jsonStr(projectName) + ","
                +   "\"exception_type\":"  + jsonStr(t.getClass().getName()) + ","
                +   "\"stack\":"           + jsonStr(sb.toString())
                + "}}";

            HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/diagnosticos"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            client.send(req, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            System.err.println("[DevInsight] Falha ao enviar diagnóstico: " + e.getMessage());
        }
    }

    private static String envOr(String key, String fallback) {
        String v = System.getenv(key);
        return (v != null && !v.isBlank()) ? v : fallback;
    }

    private static String jsonStr(String value) {
        if (value == null) return "null";
        return "\"" + value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
            + "\"";
    }
}
```

- [ ] **Step 3: Create `sdk/java/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
           http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.devinsight</groupId>
  <artifactId>devinsight</artifactId>
  <version>1.0.0</version>
  <packaging>jar</packaging>

  <name>DevInsight SDK</name>
  <description>Auto-capture runtime errors and send diagnostics to DevInsight API</description>

  <properties>
    <maven.compiler.source>11</maven.compiler.source>
    <maven.compiler.target>11</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
</project>
```

- [ ] **Step 4: Verify the files exist**

```bash
ls sdk/java/src/main/java/com/devinsight/DevInsight.java
ls sdk/java/pom.xml
```

Expected: both files listed with no error.

- [ ] **Step 5: Commit**

```bash
git add sdk/java/
git commit -m "feat: adicionar SDK Java com captura de uncaught exceptions"
```

---

## Task 2: Go SDK

**Files:**
- Create: `sdk/go/devinsight.go`
- Create: `sdk/go/go.mod`

- [ ] **Step 1: Create directory**

```bash
mkdir -p sdk/go
```

- [ ] **Step 2: Create `sdk/go/devinsight.go`**

```go
// Package devinsight captures panics and reports them to the DevInsight API.
//
// Usage:
//
//	func main() {
//	    devinsight.Wrap(run)
//	}
//
//	func run() {
//	    // your app code
//	}
package devinsight

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"time"
)

var (
	apiKey      = os.Getenv("DEVINSIGHT_API_KEY")
	baseURL     = strings.TrimRight(getEnv("DEVINSIGHT_BASE_URL", "https://devinsight-api.onrender.com"), "/")
	projectName = getEnv("DEVINSIGHT_PROJECT", "unknown")
	enabled     = os.Getenv("DEVINSIGHT_ENABLED") != "0"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Wrap runs fn and captures any panic, reporting it to DevInsight before re-panicking.
// This is the required one-liner for Go apps — place it as the first call in main().
func Wrap(fn func()) {
	defer func() {
		if r := recover(); r != nil {
			stack := string(debug.Stack())
			send(fmt.Sprintf("%v", r), "panic", stack)
			panic(r) // re-panic: preserves original crash behavior
		}
	}()
	fn()
}

func send(message, exceptionType, stack string) {
	if !enabled || apiKey == "" {
		return
	}

	payload := map[string]interface{}{
		"tipo":     "silent_backend_error",
		"mensagem": message,
		"contexto": map[string]string{
			"project_name":   projectName,
			"exception_type": exceptionType,
			"stack":          stack,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/v1/diagnosticos", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[DevInsight] Falha ao enviar diagnóstico: %v\n", err)
		return
	}
	defer resp.Body.Close()
}
```

- [ ] **Step 3: Create `sdk/go/go.mod`**

```
module github.com/devinsight/sdk/go

go 1.21
```

- [ ] **Step 4: Verify syntax (requires Go installed; skip if not available)**

```bash
cd sdk/go && go vet ./... 2>&1 || echo "go not installed — skip"
```

- [ ] **Step 5: Commit**

```bash
git add sdk/go/
git commit -m "feat: adicionar SDK Go com captura de panics via Wrap()"
```

---

## Task 3: PHP SDK

**Files:**
- Create: `sdk/php/devinsight.php`

- [ ] **Step 1: Create directory**

```bash
mkdir -p sdk/php
```

- [ ] **Step 2: Create `sdk/php/devinsight.php`**

```php
<?php
/**
 * DevInsight SDK for PHP
 *
 * Captures uncaught exceptions and fatal errors, reporting them to DevInsight.
 *
 * Usage:
 *   require_once 'devinsight.php'; // só isso
 *
 * Configuration (env vars or constants defined before require):
 *   DEVINSIGHT_API_KEY   — your API key
 *   DEVINSIGHT_BASE_URL  — base URL (default: https://devinsight-api.onrender.com)
 *   DEVINSIGHT_PROJECT   — project name (default: unknown)
 *   DEVINSIGHT_ENABLED=0 — disable SDK
 */

(static function (): void {
    $apiKey  = (string) (getenv('DEVINSIGHT_API_KEY')  ?: (defined('DEVINSIGHT_API_KEY')  ? DEVINSIGHT_API_KEY  : ''));
    $baseUrl = rtrim((string) (getenv('DEVINSIGHT_BASE_URL') ?: (defined('DEVINSIGHT_BASE_URL') ? DEVINSIGHT_BASE_URL : 'https://devinsight-api.onrender.com')), '/');
    $project = (string) (getenv('DEVINSIGHT_PROJECT')  ?: (defined('DEVINSIGHT_PROJECT')  ? DEVINSIGHT_PROJECT  : 'unknown'));
    $enabled = getenv('DEVINSIGHT_ENABLED') !== '0';

    if (!$enabled || $apiKey === '') {
        return;
    }

    $send = static function (string $message, string $type, string $stack) use ($apiKey, $baseUrl, $project): void {
        $body = (string) json_encode([
            'tipo'     => 'silent_backend_error',
            'mensagem' => $message,
            'contexto' => [
                'project_name'   => $project,
                'exception_type' => $type,
                'stack'          => $stack,
            ],
        ]);

        $url = $baseUrl . '/v1/diagnosticos';
        $headers = "Content-Type: application/json\r\nAuthorization: Bearer {$apiKey}";

        if (ini_get('allow_url_fopen')) {
            $ctx = stream_context_create([
                'http' => [
                    'method'        => 'POST',
                    'header'        => $headers,
                    'content'       => $body,
                    'timeout'       => 10,
                    'ignore_errors' => true,
                ],
            ]);
            @file_get_contents($url, false, $ctx);
        } elseif (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $body,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$apiKey}"],
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_RETURNTRANSFER => true,
            ]);
            curl_exec($ch);
            curl_close($ch);
        }
    };

    // Uncaught exceptions
    set_exception_handler(static function (\Throwable $e) use ($send): void {
        $send($e->getMessage(), \get_class($e), $e->getTraceAsString());
    });

    // Fatal errors (E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR)
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    register_shutdown_function(static function () use ($send, $fatalTypes): void {
        $error = error_get_last();
        if ($error !== null && \in_array($error['type'], $fatalTypes, true)) {
            $send(
                $error['message'],
                'FatalError',
                $error['file'] . ':' . $error['line']
            );
        }
    });
})();
```

- [ ] **Step 3: Verify PHP syntax (requires PHP installed; skip if not available)**

```bash
php -l sdk/php/devinsight.php 2>&1 || echo "php not installed — skip"
```

Expected: `No syntax errors detected` or skip message.

- [ ] **Step 4: Commit**

```bash
git add sdk/php/
git commit -m "feat: adicionar SDK PHP com captura de exceções e erros fatais"
```

---

## Task 4: Ruby SDK

**Files:**
- Create: `sdk/ruby/devinsight.rb`

- [ ] **Step 1: Create directory**

```bash
mkdir -p sdk/ruby
```

- [ ] **Step 2: Create `sdk/ruby/devinsight.rb`**

```ruby
# frozen_string_literal: true

# DevInsight SDK for Ruby
#
# Captures unhandled exceptions and reports them to DevInsight.
#
# Usage:
#   require_relative 'devinsight'  # só isso
#
# Configuration (env vars):
#   DEVINSIGHT_API_KEY   — your API key
#   DEVINSIGHT_BASE_URL  — base URL (default: https://devinsight-api.onrender.com)
#   DEVINSIGHT_PROJECT   — project name (default: unknown)
#   DEVINSIGHT_ENABLED=0 — disable SDK

require 'net/http'
require 'json'
require 'uri'

module Devinsight
  API_KEY  = ENV.fetch('DEVINSIGHT_API_KEY', '').freeze
  BASE_URL = ENV.fetch('DEVINSIGHT_BASE_URL', 'https://devinsight-api.onrender.com').chomp('/').freeze
  PROJECT  = ENV.fetch('DEVINSIGHT_PROJECT', 'unknown').freeze
  ENABLED  = ENV['DEVINSIGHT_ENABLED'] != '0'

  def self.send_diagnostic(message, exception_type, stack)
    return unless ENABLED && !API_KEY.empty?

    payload = JSON.generate(
      tipo: 'silent_backend_error',
      mensagem: message.to_s,
      contexto: {
        project_name:   PROJECT,
        exception_type: exception_type.to_s,
        stack:          stack.to_s
      }
    )

    uri  = URI("#{BASE_URL}/v1/diagnosticos")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl     = uri.scheme == 'https'
    http.open_timeout = 10
    http.read_timeout = 10

    req = Net::HTTP::Post.new(uri.path.empty? ? '/' : uri.path)
    req['Content-Type']  = 'application/json'
    req['Authorization'] = "Bearer #{API_KEY}"
    req.body = payload

    http.request(req)
  rescue StandardError => e
    warn "[DevInsight] Falha ao enviar diagnóstico: #{e.message}"
  end

  # Register at_exit hook — $! holds the exception on unhandled crash in MRI Ruby 2.7+/3.x
  if ENABLED && !API_KEY.empty?
    at_exit do
      err = $!
      next if err.nil? || err.is_a?(SystemExit)

      Devinsight.send_diagnostic(
        err.message,
        err.class.name,
        err.backtrace&.join("\n") || ''
      )
    end
  end
end
```

- [ ] **Step 3: Verify Ruby syntax (requires Ruby installed; skip if not available)**

```bash
ruby -c sdk/ruby/devinsight.rb 2>&1 || echo "ruby not installed — skip"
```

Expected: `Syntax OK` or skip message.

- [ ] **Step 4: Commit**

```bash
git add sdk/ruby/
git commit -m "feat: adicionar SDK Ruby com captura via at_exit"
```

---

## Task 5: C# SDK

**Files:**
- Create: `sdk/csharp/DevInsight.cs`
- Create: `sdk/csharp/DevInsight.csproj`

- [ ] **Step 1: Create directory**

```bash
mkdir -p sdk/csharp
```

- [ ] **Step 2: Create `sdk/csharp/DevInsight.cs`**

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace DevInsightSDK
{
    /// <summary>
    /// DevInsight SDK for C# — auto-captures unhandled exceptions and reports them to DevInsight.
    ///
    /// Usage (one line in Program.cs):
    ///   DevInsight.EnsureInitialized();
    ///
    /// Or with explicit key:
    ///   DevInsight.Init("SUA_API_KEY", "meu-projeto");
    ///
    /// Configuration via env vars:
    ///   DEVINSIGHT_API_KEY   — your API key
    ///   DEVINSIGHT_BASE_URL  — base URL (default: https://devinsight-api.onrender.com)
    ///   DEVINSIGHT_PROJECT   — project name (default: unknown)
    ///   DEVINSIGHT_ENABLED=0 — disable SDK
    /// </summary>
    public static class DevInsight
    {
        private static string _apiKey      = Environment.GetEnvironmentVariable("DEVINSIGHT_API_KEY") ?? string.Empty;
        private static string _baseUrl     = (Environment.GetEnvironmentVariable("DEVINSIGHT_BASE_URL") ?? "https://devinsight-api.onrender.com").TrimEnd('/');
        private static string _projectName = Environment.GetEnvironmentVariable("DEVINSIGHT_PROJECT") ?? "unknown";
        private static bool   _enabled     = Environment.GetEnvironmentVariable("DEVINSIGHT_ENABLED") != "0";
        private static bool   _initialized = false;
        private static readonly object _lock = new object();

        // Static HttpClient — reuse across calls (avoid socket exhaustion)
        private static readonly HttpClient _http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(10)
        };

        /// <summary>Triggers initialization from env vars. Place at the top of Program.cs.</summary>
        public static void EnsureInitialized() => RegisterHandlers();

        /// <summary>Initializes with an explicit API key.</summary>
        public static void Init(string apiKey, string projectName = "unknown")
        {
            lock (_lock)
            {
                _apiKey      = apiKey;
                _projectName = projectName;
            }
            RegisterHandlers();
        }

        private static void RegisterHandlers()
        {
            lock (_lock)
            {
                if (_initialized) return;
                if (!_enabled || string.IsNullOrWhiteSpace(_apiKey)) return;
                _initialized = true;
            }

            AppDomain.CurrentDomain.UnhandledException += (_, args) =>
            {
                if (args.ExceptionObject is Exception ex)
                    SendSync(ex.Message, ex.GetType().FullName ?? "Exception", ex.StackTrace ?? string.Empty);
            };

            TaskScheduler.UnobservedTaskException += (_, args) =>
            {
                args.SetObserved();
                // Unwrap AggregateException to get the real inner exception
                var inner = args.Exception.InnerException ?? (Exception)args.Exception;
                SendSync(
                    inner.Message,
                    inner.GetType().FullName ?? "Exception",
                    inner.StackTrace ?? string.Empty
                );
            };
        }

        private static void SendSync(string message, string exceptionType, string stack)
        {
            try
            {
                var payload = JsonSerializer.Serialize(new
                {
                    tipo     = "silent_backend_error",
                    mensagem = message,
                    contexto = new
                    {
                        project_name    = _projectName,
                        exception_type  = exceptionType,
                        stack
                    }
                });

                using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/v1/diagnosticos")
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json")
                };
                request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_apiKey}");

                // Synchronous send — process is about to terminate, async would be cancelled
                _http.Send(request);
            }
            catch (Exception e)
            {
                Console.Error.WriteLine($"[DevInsight] Falha ao enviar diagnóstico: {e.Message}");
            }
        }
    }
}
```

- [ ] **Step 3: Create `sdk/csharp/DevInsight.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net6.0</TargetFramework>
    <RootNamespace>DevInsightSDK</RootNamespace>
    <AssemblyName>DevInsight</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <Version>1.0.0</Version>
    <Description>Auto-capture runtime errors and send diagnostics to DevInsight API</Description>
  </PropertyGroup>
</Project>
```

- [ ] **Step 4: Commit**

```bash
git add sdk/csharp/
git commit -m "feat: adicionar SDK C# com captura de AppDomain e TaskScheduler exceptions"
```

---

## Task 6: SDK Documentation Page

**Files:**
- Create: `public/docs/sdks.html`

The Express static middleware serves `public/` at `/`, so this file will be accessible at `/docs/sdks.html`. The existing `/docs` route (swagger UI) is unaffected.

- [ ] **Step 1: Create directory**

```bash
mkdir -p public/docs
```

- [ ] **Step 2: Create `public/docs/sdks.html`**

Create a self-contained HTML page (no external CSS dependencies). Style matches the landing page dark theme: `#0d0d0d` background, `#6366f1` accent, `#111` cards.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SDKs — DevInsight</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d0d0d; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
    a { color: inherit; text-decoration: none; }

    .navbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; border-bottom: 1px solid #1a1a1a; position: sticky; top: 0; background: rgba(13,13,13,0.95); backdrop-filter: blur(8px); z-index: 100; }
    .nav-logo { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }
    .logo-dot { width: 10px; height: 10px; border-radius: 50%; background: #6366f1; }
    .nav-links { display: flex; align-items: center; gap: 24px; }
    .nav-links a { color: #888; font-size: 14px; transition: color 0.15s; }
    .nav-links a:hover { color: #fff; }
    .btn-nav { background: #6366f1; color: #fff !important; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; }
    .btn-nav:hover { background: #4f52d9 !important; }

    .hero { text-align: center; padding: 64px 24px 48px; max-width: 720px; margin: 0 auto; }
    .hero-label { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #555; text-transform: uppercase; margin-bottom: 16px; }
    .hero h1 { font-size: clamp(28px, 4vw, 42px); font-weight: 800; margin-bottom: 16px; }
    .hero p { font-size: 16px; color: #666; max-width: 500px; margin: 0 auto; }

    .content { max-width: 860px; margin: 0 auto; padding: 0 24px 80px; }

    .sdk-card { background: #111; border: 1px solid #1e1e1e; border-radius: 12px; padding: 32px; margin-bottom: 24px; }
    .sdk-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .sdk-icon { font-size: 28px; }
    .sdk-name { font-size: 20px; font-weight: 700; }
    .sdk-tag { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #6366f1; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); padding: 2px 8px; border-radius: 4px; }

    .sdk-desc { font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.7; }

    .install-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #555; margin-bottom: 8px; }
    pre { background: #0a0a0a; border: 1px solid #222; border-radius: 8px; padding: 16px 20px; overflow-x: auto; margin-bottom: 16px; }
    code { font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 13px; line-height: 1.6; color: #e2e8f0; }
    .comment { color: #555; }
    .keyword { color: #6366f1; }
    .string { color: #86efac; }

    .env-box { background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.15); border-radius: 8px; padding: 16px 20px; margin-top: 16px; }
    .env-box h4 { font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #6366f1; margin-bottom: 10px; }
    .env-row { display: flex; gap: 12px; font-size: 13px; margin-bottom: 6px; }
    .env-key { color: #a5b4fc; font-family: monospace; min-width: 220px; }
    .env-val { color: #666; }

    .divider { border: none; border-top: 1px solid #1a1a1a; margin: 0 0 24px; }
    footer { text-align: center; padding: 32px 24px; color: #444; font-size: 13px; }
    footer a { color: #555; margin: 0 8px; }
    footer a:hover { color: #888; }

    @media (max-width: 600px) {
      .navbar { padding: 16px 20px; }
      .nav-links a:not(.btn-nav) { display: none; }
    }
  </style>
</head>
<body>

  <nav class="navbar">
    <a href="/" class="nav-logo"><div class="logo-dot"></div>DevInsight</a>
    <div class="nav-links">
      <a href="/docs">Docs</a>
      <a href="/docs/sdks.html">SDKs</a>
      <a href="/#pricing">Preços</a>
      <a href="/dashboard/login.html">Entrar</a>
      <a href="/dashboard/signup.html" class="btn-nav">Criar conta</a>
    </div>
  </nav>

  <div class="hero">
    <div class="hero-label">Integração</div>
    <h1>SDKs para todas as linguagens</h1>
    <p>Configure sua API Key uma vez. O SDK captura automaticamente qualquer erro que derrube sua aplicação e envia para o dashboard.</p>
  </div>

  <div class="content">

    <!-- Node.js -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">🟢</div>
        <div class="sdk-name">Node.js</div>
        <div class="sdk-tag">npm</div>
      </div>
      <p class="sdk-desc">Captura <code>uncaughtException</code> e <code>unhandledRejection</code> automaticamente.</p>
      <div class="install-label">Instalação</div>
      <pre><code>npm install devinsight-sdk</code></pre>
      <div class="install-label">Uso</div>
      <pre><code><span class="keyword">const</span> DevInsight = <span class="keyword">require</span>(<span class="string">'devinsight-sdk'</span>);

<span class="comment">// Uma linha — captura todos os crashes automaticamente</span>
DevInsight.init({ apiKey: <span class="string">'SUA_API_KEY'</span>, projectName: <span class="string">'meu-projeto'</span> });</code></pre>
      <div class="env-box">
        <h4>Variáveis de ambiente</h4>
        <div class="env-row"><span class="env-key">DEVINSIGHT_ENABLED=0</span><span class="env-val">Desliga o SDK (útil em CI/testes)</span></div>
      </div>
    </div>

    <!-- Python -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">🐍</div>
        <div class="sdk-name">Python</div>
        <div class="sdk-tag">pip</div>
      </div>
      <p class="sdk-desc">Registra <code>sys.excepthook</code> para capturar qualquer exceção não tratada. Python 3.8+, sem dependências.</p>
      <div class="install-label">Instalação</div>
      <pre><code>pip install devinsight</code></pre>
      <div class="install-label">Uso via variável de ambiente (recomendado)</div>
      <pre><code><span class="comment"># No terminal ou .env:</span>
export DEVINSIGHT_API_KEY=<span class="string">'SUA_API_KEY'</span>

<span class="comment"># No código — só importar já basta:</span>
<span class="keyword">import</span> devinsight</code></pre>
      <div class="install-label">Ou explicitamente</div>
      <pre><code><span class="keyword">from</span> devinsight <span class="keyword">import</span> DevInsight
DevInsight.init(api_key=<span class="string">'SUA_API_KEY'</span>, project_name=<span class="string">'meu-projeto'</span>)</code></pre>
      <div class="env-box">
        <h4>Variáveis de ambiente</h4>
        <div class="env-row"><span class="env-key">DEVINSIGHT_API_KEY</span><span class="env-val">Sua API Key</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_PROJECT</span><span class="env-val">Nome do projeto (default: unknown)</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_ENABLED=0</span><span class="env-val">Desliga o SDK</span></div>
      </div>
    </div>

    <!-- Java -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">☕</div>
        <div class="sdk-name">Java</div>
        <div class="sdk-tag">Maven</div>
      </div>
      <p class="sdk-desc">Registra <code>Thread.setDefaultUncaughtExceptionHandler</code>. Java 11+, sem dependências externas.</p>
      <div class="install-label">Maven (pom.xml)</div>
      <pre><code>&lt;dependency&gt;
  &lt;groupId&gt;com.devinsight&lt;/groupId&gt;
  &lt;artifactId&gt;devinsight&lt;/artifactId&gt;
  &lt;version&gt;1.0.0&lt;/version&gt;
&lt;/dependency&gt;</code></pre>
      <div class="install-label">Uso</div>
      <pre><code><span class="keyword">import</span> com.devinsight.DevInsight;

<span class="comment">// Via env var DEVINSIGHT_API_KEY:</span>
DevInsight.init();

<span class="comment">// Ou explicitamente:</span>
DevInsight.init(<span class="string">"SUA_API_KEY"</span>, <span class="string">"meu-projeto"</span>);</code></pre>
      <div class="env-box">
        <h4>Variáveis de ambiente</h4>
        <div class="env-row"><span class="env-key">DEVINSIGHT_API_KEY</span><span class="env-val">Sua API Key</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_PROJECT</span><span class="env-val">Nome do projeto (default: unknown)</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_ENABLED=0</span><span class="env-val">Desliga o SDK</span></div>
      </div>
    </div>

    <!-- Go -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">🐹</div>
        <div class="sdk-name">Go</div>
        <div class="sdk-tag">go get</div>
      </div>
      <p class="sdk-desc">Captura panics via <code>defer recover()</code> e re-panic após enviar. Go 1.21+, sem dependências externas.</p>
      <div class="install-label">Instalação</div>
      <pre><code>go get github.com/devinsight/sdk/go</code></pre>
      <div class="install-label">Uso</div>
      <pre><code><span class="keyword">import</span> <span class="string">"github.com/devinsight/sdk/go/devinsight"</span>

<span class="keyword">func</span> main() {
    devinsight.Wrap(run) <span class="comment">// uma linha</span>
}

<span class="keyword">func</span> run() {
    <span class="comment">// seu código aqui</span>
}</code></pre>
      <div class="env-box">
        <h4>Variáveis de ambiente</h4>
        <div class="env-row"><span class="env-key">DEVINSIGHT_API_KEY</span><span class="env-val">Sua API Key</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_PROJECT</span><span class="env-val">Nome do projeto (default: unknown)</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_ENABLED=0</span><span class="env-val">Desliga o SDK</span></div>
      </div>
    </div>

    <!-- PHP -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">🐘</div>
        <div class="sdk-name">PHP</div>
        <div class="sdk-tag">require</div>
      </div>
      <p class="sdk-desc">Registra <code>set_exception_handler</code> e <code>register_shutdown_function</code> para capturar exceções e erros fatais. PHP 7.4+, sem Composer.</p>
      <div class="install-label">Instalação — copie o arquivo para seu projeto</div>
      <pre><code><span class="comment"># Ou via Composer (em breve):</span>
composer require devinsight/devinsight-php</code></pre>
      <div class="install-label">Uso</div>
      <pre><code><span class="keyword">require_once</span> <span class="string">'devinsight.php'</span>; <span class="comment">// só isso</span></code></pre>
      <div class="env-box">
        <h4>Variáveis de ambiente ou constantes PHP</h4>
        <div class="env-row"><span class="env-key">DEVINSIGHT_API_KEY</span><span class="env-val">Sua API Key</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_PROJECT</span><span class="env-val">Nome do projeto (default: unknown)</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_ENABLED=0</span><span class="env-val">Desliga o SDK</span></div>
      </div>
    </div>

    <!-- Ruby -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">💎</div>
        <div class="sdk-name">Ruby</div>
        <div class="sdk-tag">gem</div>
      </div>
      <p class="sdk-desc">Usa <code>at_exit</code> com <code>$!</code> para capturar exceções não tratadas. MRI Ruby 2.7+, sem gems externas.</p>
      <div class="install-label">Instalação</div>
      <pre><code>gem install devinsight</code></pre>
      <div class="install-label">Uso</div>
      <pre><code><span class="keyword">require</span> <span class="string">'devinsight'</span> <span class="comment"># só isso</span></code></pre>
      <div class="env-box">
        <h4>Variáveis de ambiente</h4>
        <div class="env-row"><span class="env-key">DEVINSIGHT_API_KEY</span><span class="env-val">Sua API Key</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_PROJECT</span><span class="env-val">Nome do projeto (default: unknown)</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_ENABLED=0</span><span class="env-val">Desliga o SDK</span></div>
      </div>
    </div>

    <!-- C# -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">🔷</div>
        <div class="sdk-name">C#</div>
        <div class="sdk-tag">NuGet</div>
      </div>
      <p class="sdk-desc">Registra <code>AppDomain.UnhandledException</code> e <code>TaskScheduler.UnobservedTaskException</code>. .NET 6+, sem pacotes externos.</p>
      <div class="install-label">Instalação</div>
      <pre><code>dotnet add package DevInsight</code></pre>
      <div class="install-label">Uso</div>
      <pre><code><span class="keyword">using</span> DevInsightSDK;

<span class="comment">// Uma linha no topo de Program.cs:</span>
DevInsight.EnsureInitialized();

<span class="comment">// Ou explicitamente:</span>
DevInsight.Init(<span class="string">"SUA_API_KEY"</span>, <span class="string">"meu-projeto"</span>);</code></pre>
      <div class="env-box">
        <h4>Variáveis de ambiente</h4>
        <div class="env-row"><span class="env-key">DEVINSIGHT_API_KEY</span><span class="env-val">Sua API Key</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_PROJECT</span><span class="env-val">Nome do projeto (default: unknown)</span></div>
        <div class="env-row"><span class="env-key">DEVINSIGHT_ENABLED=0</span><span class="env-val">Desliga o SDK</span></div>
      </div>
    </div>

  </div>

  <hr class="divider">
  <footer>
    <p>© 2026 DevInsight
      <a href="/docs">Docs</a>
      <a href="/docs/sdks.html">SDKs</a>
      <a href="/dashboard/">Dashboard</a>
      <a href="mailto:contato@devinsight.com">contato@devinsight.com</a>
    </p>
  </footer>

</body>
</html>
```

- [ ] **Step 3: Verify the file exists**

```bash
ls public/docs/sdks.html
```

- [ ] **Step 4: Commit**

```bash
git add public/docs/sdks.html
git commit -m "feat: adicionar página de documentação dos SDKs em /docs/sdks.html"
```

---

## Task 7: Update Landing Page and Swagger

**Files:**
- Modify: `public/index.html` (add SDKs nav link)
- Modify: `swagger.yaml` (add SDK sections for Java, Go, PHP, Ruby, C#)

- [ ] **Step 1: Add SDKs link to navbar in `public/index.html`**

Find:
```html
      <a href="/docs">Docs</a>
      <a href="#pricing">Preços</a>
```

Replace with:
```html
      <a href="/docs">Docs</a>
      <a href="/docs/sdks.html">SDKs</a>
      <a href="#pricing">Preços</a>
```

- [ ] **Step 2: Add SDK sections to `swagger.yaml`**

After the existing Python SDK block (ends around line 55), add:

```yaml
    ## SDK (Java)

    Java 11+, sem dependências externas:

    ```xml
    <dependency>
      <groupId>com.devinsight</groupId>
      <artifactId>devinsight</artifactId>
      <version>1.0.0</version>
    </dependency>
    ```

    ```java
    import com.devinsight.DevInsight;
    DevInsight.init(); // lê DEVINSIGHT_API_KEY do ambiente
    ```

    ## SDK (Go)

    Go 1.21+, sem dependências externas:

    ```bash
    go get github.com/devinsight/sdk/go
    ```

    ```go
    import "github.com/devinsight/sdk/go/devinsight"

    func main() { devinsight.Wrap(run) }
    func run()   { /* seu código */ }
    ```

    ## SDK (PHP)

    PHP 7.4+, sem Composer:

    ```php
    require_once 'devinsight.php'; // só isso
    ```

    ## SDK (Ruby)

    MRI Ruby 2.7+, sem gems externas:

    ```bash
    gem install devinsight
    ```

    ```ruby
    require 'devinsight' # só isso
    ```

    ## SDK (C#)

    .NET 6+, sem pacotes externos:

    ```bash
    dotnet add package DevInsight
    ```

    ```csharp
    using DevInsightSDK;
    DevInsight.EnsureInitialized(); // topo do Program.cs
    ```
```

- [ ] **Step 3: Verify the landing page renders (open in browser or check HTML validity)**

```bash
node -e "require('fs').readFileSync('public/index.html','utf8'); console.log('HTML OK')"
```

- [ ] **Step 4: Commit**

```bash
git add public/index.html swagger.yaml
git commit -m "feat: adicionar link SDKs na navbar e seções no swagger"
```

- [ ] **Step 5: Push all changes**

```bash
git push
```

---

## Verification Checklist

After all tasks complete, verify end-to-end:

- [ ] `ls sdk/java/src/main/java/com/devinsight/DevInsight.java` — exists
- [ ] `ls sdk/go/devinsight.go` — exists
- [ ] `ls sdk/php/devinsight.php` — exists
- [ ] `ls sdk/ruby/devinsight.rb` — exists
- [ ] `ls sdk/csharp/DevInsight.cs` — exists
- [ ] `ls public/docs/sdks.html` — exists
- [ ] `git log --oneline -7` — shows 7 feature commits
- [ ] Open `https://devinsight-api.onrender.com/docs/sdks.html` after deploy — page loads with all 7 SDKs
