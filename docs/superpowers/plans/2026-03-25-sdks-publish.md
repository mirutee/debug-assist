# SDK Publishing (debug-assist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand os 6 SDKs de `DevInsight` para `DebugAssist` e preparar todos os arquivos de empacotamento e CI/CD para publicação nos registros (PyPI, RubyGems, Packagist, Maven Central, pkg.go.dev, NuGet).

**Architecture:** Cada SDK vive em `sdk/<lang>/` neste repositório. O plano cria arquivos novos e modifica os existentes em cada subpasta. Após este plano, o conteúdo de cada subpasta será copiado para repositórios separados na org `github.com/debug-assist`.

**Tech Stack:** Python/PyPI, Ruby/RubyGems, PHP/Packagist, Java/Maven Central (Sonatype Central), Go/pkg.go.dev, C#/NuGet — GitHub Actions para CI/CD de todos.

---

## Renomeações globais (referência rápida)

| Before | After |
|--------|-------|
| `DevInsight` (classe/namespace) | `DebugAssist` |
| `devinsight` (módulo/package) | `debug_assist` (Python/Ruby) / `debugassist` (Go/Java package) |
| `DEVINSIGHT_API_KEY` | `DEBUG_ASSIST_API_KEY` |
| `DEVINSIGHT_BASE_URL` | `DEBUG_ASSIST_BASE_URL` |
| `DEVINSIGHT_PROJECT` | `DEBUG_ASSIST_PROJECT` |
| `DEVINSIGHT_ENABLED` | `DEBUG_ASSIST_ENABLED` |
| `https://devinsight-api.onrender.com` | `https://api.debug-assist.app` |
| `[DevInsight]` (logs) | `[DebugAssist]` (logs) |

---

## Task 1: Python SDK — rebranding + pyproject.toml

**Files:**
- Modify: `sdk/python/devinsight.py` → rename to `sdk/python/debug_assist.py`
- Create: `sdk/python/pyproject.toml`
- Create: `sdk/python/README.md`
- Create: `sdk/python/.github/workflows/publish.yml`

- [ ] **Step 1: Criar o arquivo rebranded `debug_assist.py`**

Criar `sdk/python/debug_assist.py` com o conteúdo abaixo (substitui `devinsight.py`):

```python
"""
DebugAssist Python SDK

Captura automaticamente exceções não tratadas e envia para a API DebugAssist.

Modo mais simples — via variável de ambiente:
    export DEBUG_ASSIST_API_KEY='SUA_API_KEY'
    import debug_assist  # só isso já basta, monitoramento ativado

Modo explícito (quando a chave vem do código):
    from debug_assist import DebugAssist
    DebugAssist.init(api_key='SUA_API_KEY', project_name='meu-projeto')

Envio manual:
    client = DebugAssist(api_key='SUA_API_KEY')
    client.report(tipo='silent_backend_error', mensagem=str(e))
"""

import json
import os
import sys
import traceback
import urllib.request

DEFAULT_BASE_URL = 'https://api.debug-assist.app'


class DebugAssist:
    _initialized = False

    def __init__(self, api_key, base_url=None):
        if not api_key:
            raise ValueError('DebugAssist: api_key é obrigatória')
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip('/')

    def report(self, tipo, mensagem='', contexto=None, dados=None):
        """Envia um diagnóstico para a API DebugAssist.

        Args:
            tipo: Categoria do erro (ex: 'silent_backend_error', 'sql_analysis').
            mensagem: Mensagem de erro (ex: str(e)).
            contexto: Dict com dados adicionais (rota, método, etc.).
            dados: Dict para sql_analysis (query, tempo_execucao).

        Returns:
            Dict com o diagnóstico retornado pela API.
        """
        if not tipo:
            raise ValueError("DebugAssist: campo 'tipo' é obrigatório")

        body = {'tipo': tipo, 'mensagem': mensagem}
        if contexto:
            body['contexto'] = contexto
        if dados:
            body['dados'] = dados

        encoded = json.dumps(body).encode('utf-8')
        req = urllib.request.Request(
            f'{self.base_url}/v1/diagnosticos',
            data=encoded,
            method='POST',
        )
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', f'Bearer {self.api_key}')

        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))

    @classmethod
    def init(cls, api_key, project_name='unknown', base_url=None):
        """Registra o hook de exceções não tratadas.

        Após chamar init(), qualquer exceção que derrube o processo é
        automaticamente enviada para a API antes de encerrar.

        Args:
            api_key: Sua API Key (obtida em /v1/auth/me).
            project_name: Nome do projeto (aparece no contexto do diagnóstico).
            base_url: URL base da API (padrão: https://api.debug-assist.app).
        """
        if cls._initialized:
            return

        client = cls(api_key=api_key, base_url=base_url)
        cls._initialized = True

        original_excepthook = sys.excepthook

        def _excepthook(exc_type, exc_value, exc_traceback):
            stack = ''.join(traceback.format_tb(exc_traceback))
            try:
                client.report(
                    tipo='silent_backend_error',
                    mensagem=str(exc_value),
                    contexto={
                        'project_name': project_name,
                        'exception_type': exc_type.__name__,
                        'stack': stack,
                    },
                )
            except Exception:
                pass
            original_excepthook(exc_type, exc_value, exc_traceback)

        sys.excepthook = _excepthook


# Auto-inicializa se DEBUG_ASSIST_API_KEY estiver no ambiente
_env_key = os.getenv('DEBUG_ASSIST_API_KEY')
if _env_key and os.getenv('DEBUG_ASSIST_ENABLED', '1') != '0':
    DebugAssist.init(
        api_key=_env_key,
        project_name=os.getenv('DEBUG_ASSIST_PROJECT', 'unknown'),
        base_url=os.getenv('DEBUG_ASSIST_BASE_URL'),
    )
```

- [ ] **Step 2: Verificar que o módulo importa corretamente**

```bash
cd sdk/python
python -c "from debug_assist import DebugAssist; print('OK')"
```

Esperado: `OK` (sem erros)

- [ ] **Step 3: Criar `sdk/python/pyproject.toml`**

```toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "debug-assist"
version = "1.0.0"
description = "Auto-capture runtime errors and send diagnostics to DebugAssist API"
readme = "README.md"
requires-python = ">=3.8"
license = {text = "MIT"}
classifiers = [
    "Programming Language :: Python :: 3",
    "License :: OSI Approved :: MIT License",
    "Operating System :: OS Independent",
]

[project.urls]
Homepage = "https://github.com/debug-assist/sdk-python"

[tool.setuptools]
py-modules = ["debug_assist"]
```

- [ ] **Step 4: Criar `sdk/python/README.md`**

```markdown
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
```

- [ ] **Step 5: Criar `sdk/python/.github/workflows/publish.yml`**

Primeiro criar o diretório: `sdk/python/.github/workflows/`

```yaml
name: Publish to PyPI

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Build
        run: |
          pip install build
          python -m build

      - name: Publish
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          password: ${{ secrets.PYPI_API_TOKEN }}
```

- [ ] **Step 6: Remover arquivo antigo e commitar**

```bash
cd sdk/python
rm devinsight.py
cd ../..
git add sdk/python/
git commit -m "feat(sdk-python): rebrand para DebugAssist + pyproject.toml + CI"
```

---

## Task 2: Ruby SDK — rebranding + gemspec

**Files:**
- Modify: `sdk/ruby/devinsight.rb` → rename to `sdk/ruby/lib/debug_assist.rb`
- Create: `sdk/ruby/debug-assist.gemspec`
- Create: `sdk/ruby/README.md`
- Create: `sdk/ruby/.github/workflows/publish.yml`

- [ ] **Step 1: Criar diretório `lib/` e o arquivo rebranded**

Criar `sdk/ruby/lib/debug_assist.rb`:

```ruby
# frozen_string_literal: true

# DebugAssist SDK for Ruby
#
# Captures unhandled exceptions and reports them to DebugAssist.
#
# Usage:
#   require 'debug_assist'  # só isso
#
# Configuration (env vars):
#   DEBUG_ASSIST_API_KEY   — your API key
#   DEBUG_ASSIST_BASE_URL  — base URL (default: https://api.debug-assist.app)
#   DEBUG_ASSIST_PROJECT   — project name (default: unknown)
#   DEBUG_ASSIST_ENABLED=0 — disable SDK

require 'net/http'
require 'json'
require 'uri'

module DebugAssist
  API_KEY  = ENV.fetch('DEBUG_ASSIST_API_KEY', '').freeze
  BASE_URL = ENV.fetch('DEBUG_ASSIST_BASE_URL', 'https://api.debug-assist.app').chomp('/').freeze
  PROJECT  = ENV.fetch('DEBUG_ASSIST_PROJECT', 'unknown').freeze
  ENABLED  = ENV['DEBUG_ASSIST_ENABLED'] != '0'

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
    warn "[DebugAssist] Falha ao enviar diagnóstico: #{e.message}"
  end

  # Register at_exit hook
  if ENABLED && !API_KEY.empty?
    at_exit do
      err = $!
      next if err.nil? || err.is_a?(SystemExit)

      DebugAssist.send_diagnostic(
        err.message,
        err.class.name,
        err.backtrace&.join("\n") || ''
      )
    end
  end
end
```

- [ ] **Step 2: Verificar que o módulo carrega**

```bash
cd sdk/ruby
ruby -e "require_relative 'lib/debug_assist'; puts DebugAssist::ENABLED"
```

Esperado: `true` (sem erros)

- [ ] **Step 3: Criar `sdk/ruby/debug-assist.gemspec`**

```ruby
# frozen_string_literal: true

Gem::Specification.new do |s|
  s.name        = 'debug-assist'
  s.version     = '1.0.0'
  s.summary     = 'Auto-capture runtime errors and send diagnostics to DebugAssist API'
  s.description = 'DebugAssist SDK for Ruby — captures unhandled exceptions and reports them to DebugAssist for diagnosis.'
  s.authors     = ['DebugAssist']
  s.email       = 'hi@debug-assist.app'
  s.files       = ['lib/debug_assist.rb']
  s.homepage    = 'https://github.com/debug-assist/sdk-ruby'
  s.license     = 'MIT'
  s.required_ruby_version = '>= 2.7'
end
```

- [ ] **Step 4: Criar `sdk/ruby/README.md`**

```markdown
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
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://api.debug-assist.app` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
```

- [ ] **Step 5: Criar `sdk/ruby/.github/workflows/publish.yml`**

```yaml
name: Publish to RubyGems

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'

      - name: Build gem
        run: gem build debug-assist.gemspec

      - name: Push gem
        run: gem push *.gem
        env:
          GEM_HOST_API_KEY: ${{ secrets.RUBYGEMS_API_KEY }}
```

- [ ] **Step 6: Remover arquivo antigo e commitar**

```bash
rm sdk/ruby/devinsight.rb
git add sdk/ruby/
git commit -m "feat(sdk-ruby): rebrand para DebugAssist + gemspec + CI"
```

---

## Task 3: PHP SDK — rebranding + composer.json

**Files:**
- Modify: `sdk/php/devinsight.php` → rename to `sdk/php/debug_assist.php`
- Create: `sdk/php/composer.json`
- Create: `sdk/php/README.md`
- Create: `sdk/php/.github/workflows/publish.yml`

- [ ] **Step 1: Criar o arquivo rebranded `debug_assist.php`**

Criar `sdk/php/debug_assist.php`:

```php
<?php
/**
 * DebugAssist SDK for PHP
 *
 * Captures uncaught exceptions and fatal errors, reporting them to DebugAssist.
 *
 * Usage:
 *   require_once 'debug_assist.php'; // só isso
 *
 * Configuration (env vars or constants defined before require):
 *   DEBUG_ASSIST_API_KEY   — your API key
 *   DEBUG_ASSIST_BASE_URL  — base URL (default: https://api.debug-assist.app)
 *   DEBUG_ASSIST_PROJECT   — project name (default: unknown)
 *   DEBUG_ASSIST_ENABLED=0 — disable SDK
 */

(static function (): void {
    $apiKey  = (string) (getenv('DEBUG_ASSIST_API_KEY')  ?: (defined('DEBUG_ASSIST_API_KEY')  ? DEBUG_ASSIST_API_KEY  : ''));
    $baseUrl = rtrim((string) (getenv('DEBUG_ASSIST_BASE_URL') ?: (defined('DEBUG_ASSIST_BASE_URL') ? DEBUG_ASSIST_BASE_URL : 'https://api.debug-assist.app')), '/');
    $project = (string) (getenv('DEBUG_ASSIST_PROJECT')  ?: (defined('DEBUG_ASSIST_PROJECT')  ? DEBUG_ASSIST_PROJECT  : 'unknown'));
    $enabled = getenv('DEBUG_ASSIST_ENABLED') !== '0';

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

- [ ] **Step 2: Verificar que o arquivo carrega sem erros**

```bash
cd sdk/php
php -r "require 'debug_assist.php'; echo 'OK' . PHP_EOL;"
```

Esperado: `OK` (sem erros de parse ou fatal)

- [ ] **Step 3: Criar `sdk/php/composer.json`**

```json
{
    "name": "debug-assist/debug-assist",
    "description": "Auto-capture runtime errors and send diagnostics to DebugAssist API",
    "type": "library",
    "license": "MIT",
    "require": {
        "php": ">=7.4"
    },
    "autoload": {
        "files": ["debug_assist.php"]
    },
    "homepage": "https://github.com/debug-assist/sdk-php",
    "authors": [
        {
            "name": "DebugAssist",
            "email": "hi@debug-assist.app"
        }
    ]
}
```

- [ ] **Step 4: Criar `sdk/php/README.md`**

```markdown
# DebugAssist PHP SDK

Auto-capture runtime errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

```bash
composer require debug-assist/debug-assist
```

## Usage

```php
require_once 'vendor/autoload.php';
// unhandled exceptions and fatal errors are captured automatically
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_ASSIST_API_KEY` | Your API key | — |
| `DEBUG_ASSIST_PROJECT` | Project name shown in diagnostics | `unknown` |
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://api.debug-assist.app` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
```

- [ ] **Step 5: Criar `sdk/php/.github/workflows/publish.yml`**

Packagist não usa push direto — é notificado via webhook HTTP. O workflow abaixo envia o webhook ao criar uma tag.

```yaml
name: Notify Packagist

on:
  push:
    tags:
      - 'v*'

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Packagist of new release
        run: |
          curl -s -X POST \
            -H "Content-Type: application/json" \
            "https://packagist.org/api/update-package?username=debug-assist&apiToken=${{ secrets.PACKAGIST_TOKEN }}" \
            -d '{"repository":{"url":"https://github.com/debug-assist/sdk-php"}}'
```

- [ ] **Step 6: Remover arquivo antigo e commitar**

```bash
rm sdk/php/devinsight.php
git add sdk/php/
git commit -m "feat(sdk-php): rebrand para DebugAssist + composer.json + CI"
```

---

## Task 4: Java SDK — rebranding + pom.xml completo para Maven Central

**Files:**
- Create: `sdk/java/src/main/java/io/github/debugassist/DebugAssist.java`
- Delete: `sdk/java/src/main/java/com/devinsight/DevInsight.java`
- Modify: `sdk/java/pom.xml`
- Create: `sdk/java/README.md`
- Create: `sdk/java/.github/workflows/publish.yml`

- [ ] **Step 1: Criar diretório e o arquivo Java rebranded**

Criar `sdk/java/src/main/java/io/github/debugassist/DebugAssist.java`:

```java
package io.github.debugassist;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public final class DebugAssist {

    private static final String DEFAULT_BASE_URL = "https://api.debug-assist.app";
    private static boolean initialized = false;

    private DebugAssist() {}

    /** Reads DEBUG_ASSIST_API_KEY from environment and registers the crash handler. */
    public static synchronized void init() {
        String apiKey = System.getenv("DEBUG_ASSIST_API_KEY");
        String project = envOr("DEBUG_ASSIST_PROJECT", "unknown");
        if (apiKey != null && !apiKey.isBlank()) {
            init(apiKey, project);
        }
    }

    /** Registers the crash handler with an explicit API key. */
    public static synchronized void init(String apiKey, String projectName) {
        if (initialized) return;
        if ("0".equals(System.getenv("DEBUG_ASSIST_ENABLED"))) return;
        if (apiKey == null || apiKey.isBlank()) return;

        initialized = true;

        final String key     = apiKey;
        final String project = projectName != null ? projectName : "unknown";
        final String base    = envOr("DEBUG_ASSIST_BASE_URL", DEFAULT_BASE_URL).replaceAll("/+$", "");

        final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            send(key, base, project, throwable, httpClient);
            if (previous != null) {
                previous.uncaughtException(thread, throwable);
            } else {
                System.exit(1);
            }
        });
    }

    private static void send(String apiKey, String baseUrl, String projectName, Throwable t, HttpClient httpClient) {
        try {
            StringBuilder sb = new StringBuilder();
            for (StackTraceElement el : t.getStackTrace()) {
                sb.append("\tat ").append(el).append("\n");
            }
            String body = "{"
                + "\"tipo\":\"silent_backend_error\","
                + "\"mensagem\":" + jsonStr(t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName()) + ","
                + "\"contexto\":{"
                +   "\"project_name\":"    + jsonStr(projectName) + ","
                +   "\"exception_type\":"  + jsonStr(t.getClass().getName()) + ","
                +   "\"stack\":"           + jsonStr(sb.toString())
                + "}}";

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/diagnosticos"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            httpClient.send(req, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            System.err.println("[DebugAssist] Falha ao enviar diagnóstico: " + e.getMessage());
        }
    }

    private static String envOr(String key, String fallback) {
        String v = System.getenv(key);
        return (v != null && !v.isBlank()) ? v : fallback;
    }

    private static String jsonStr(String value) {
        if (value == null) return "null";
        StringBuilder sb = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"':  sb.append("\\\""); break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
    }
}
```

- [ ] **Step 2: Substituir `sdk/java/pom.xml`**

Maven Central exige: licença, scm, developers, gpg signing, sources jar, javadoc jar, e o `central-publishing-maven-plugin`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
           http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>io.github.debug-assist</groupId>
  <artifactId>debug-assist</artifactId>
  <version>1.0.0</version>
  <packaging>jar</packaging>

  <name>DebugAssist SDK</name>
  <description>Auto-capture runtime errors and send diagnostics to DebugAssist API</description>
  <url>https://github.com/debug-assist/sdk-java</url>

  <licenses>
    <license>
      <name>MIT License</name>
      <url>https://opensource.org/licenses/MIT</url>
    </license>
  </licenses>

  <developers>
    <developer>
      <id>debug-assist</id>
      <name>DebugAssist</name>
      <email>hi@debug-assist.app</email>
    </developer>
  </developers>

  <scm>
    <connection>scm:git:git://github.com/debug-assist/sdk-java.git</connection>
    <developerConnection>scm:git:ssh://github.com/debug-assist/sdk-java.git</developerConnection>
    <url>https://github.com/debug-assist/sdk-java/tree/main</url>
  </scm>

  <properties>
    <maven.compiler.source>11</maven.compiler.source>
    <maven.compiler.target>11</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <build>
    <plugins>
      <!-- Sources JAR (obrigatório no Maven Central) -->
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-source-plugin</artifactId>
        <version>3.3.0</version>
        <executions>
          <execution>
            <id>attach-sources</id>
            <goals><goal>jar-no-fork</goal></goals>
          </execution>
        </executions>
      </plugin>

      <!-- Javadoc JAR (obrigatório no Maven Central) -->
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-javadoc-plugin</artifactId>
        <version>3.6.3</version>
        <executions>
          <execution>
            <id>attach-javadocs</id>
            <goals><goal>jar</goal></goals>
          </execution>
        </executions>
      </plugin>

      <!-- GPG signing (obrigatório no Maven Central) -->
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-gpg-plugin</artifactId>
        <version>3.1.0</version>
        <executions>
          <execution>
            <id>sign-artifacts</id>
            <phase>verify</phase>
            <goals><goal>sign</goal></goals>
          </execution>
        </executions>
      </plugin>

      <!-- Central Publishing Plugin (novo portal Maven Central) -->
      <plugin>
        <groupId>org.sonatype.central</groupId>
        <artifactId>central-publishing-maven-plugin</artifactId>
        <version>0.4.0</version>
        <extensions>true</extensions>
        <configuration>
          <publishingServerId>central</publishingServerId>
          <tokenEnabled>true</tokenEnabled>
          <autoPublish>true</autoPublish>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 3: Verificar que compila**

```bash
cd sdk/java
mvn compile -q
```

Esperado: BUILD SUCCESS sem erros

- [ ] **Step 4: Criar `sdk/java/README.md`**

```markdown
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
| `DEBUG_ASSIST_BASE_URL` | API base URL | `https://api.debug-assist.app` |
| `DEBUG_ASSIST_ENABLED` | Set to `0` to disable | enabled |
```

- [ ] **Step 5: Criar `sdk/java/.github/workflows/publish.yml`**

```yaml
name: Publish to Maven Central

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          java-version: '11'
          distribution: 'temurin'
          server-id: central
          server-username: MAVEN_USERNAME
          server-password: MAVEN_PASSWORD
          gpg-private-key: ${{ secrets.GPG_PRIVATE_KEY }}
          gpg-passphrase: MAVEN_GPG_PASSPHRASE

      - name: Deploy to Maven Central
        run: mvn --no-transfer-progress --batch-mode deploy
        env:
          MAVEN_USERNAME: ${{ secrets.OSSRH_USERNAME }}
          MAVEN_PASSWORD: ${{ secrets.OSSRH_PASSWORD }}
          MAVEN_GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
```

- [ ] **Step 6: Remover arquivo antigo e commitar**

```bash
rm sdk/java/src/main/java/com/devinsight/DevInsight.java
rmdir -p sdk/java/src/main/java/com/devinsight 2>/dev/null || true
git add sdk/java/
git commit -m "feat(sdk-java): rebrand para DebugAssist + pom.xml Maven Central + CI"
```

---

## Task 5: Go SDK — rebranding + go.mod atualizado

**Files:**
- Modify: `sdk/go/devinsight.go` → rename to `sdk/go/debugassist.go`
- Modify: `sdk/go/go.mod`
- Create: `sdk/go/README.md`
- Create: `sdk/go/.github/workflows/ci.yml`

- [ ] **Step 1: Criar o arquivo Go rebranded**

Criar `sdk/go/debugassist.go`:

```go
// Package debugassist captures panics and reports them to the DebugAssist API.
//
// Usage:
//
//	func main() {
//	    debugassist.Wrap(run)
//	}
//
//	func run() {
//	    // your app code
//	}
package debugassist

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
	apiKey      = os.Getenv("DEBUG_ASSIST_API_KEY")
	baseURL     = strings.TrimRight(getEnv("DEBUG_ASSIST_BASE_URL", "https://api.debug-assist.app"), "/")
	projectName = getEnv("DEBUG_ASSIST_PROJECT", "unknown")
	enabled     = os.Getenv("DEBUG_ASSIST_ENABLED") != "0"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Wrap runs fn and captures any panic, reporting it to DebugAssist before re-panicking.
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
		fmt.Fprintf(os.Stderr, "[DebugAssist] Falha ao serializar payload: %v\n", err)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/v1/diagnosticos", bytes.NewReader(body))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[DebugAssist] Falha ao criar requisição: %v\n", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[DebugAssist] Falha ao enviar diagnóstico: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		fmt.Fprintf(os.Stderr, "[DebugAssist] Servidor retornou erro: status %d\n", resp.StatusCode)
	}
}
```

- [ ] **Step 2: Atualizar `sdk/go/go.mod`**

```
module github.com/debug-assist/sdk-go

go 1.21
```

- [ ] **Step 3: Verificar que compila**

```bash
cd sdk/go
go build ./...
go vet ./...
```

Esperado: sem erros

- [ ] **Step 4: Criar `sdk/go/README.md`**

```markdown
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
```

- [ ] **Step 5: Criar `sdk/go/.github/workflows/ci.yml`**

Go não precisa de workflow de publicação — `pkg.go.dev` indexa automaticamente quando uma tag é criada no GitHub. O workflow abaixo só roda CI.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      - name: Build
        run: go build ./...

      - name: Vet
        run: go vet ./...
```

- [ ] **Step 6: Remover arquivo antigo e commitar**

```bash
rm sdk/go/devinsight.go
git add sdk/go/
git commit -m "feat(sdk-go): rebrand para DebugAssist + go.mod + CI"
```

---

## Task 6: C# SDK — rebranding + .csproj para NuGet

**Files:**
- Modify: `sdk/csharp/DevInsight.cs` → rename to `sdk/csharp/DebugAssist.cs`
- Modify: `sdk/csharp/DebugAssist.csproj`
- Create: `sdk/csharp/README.md`
- Create: `sdk/csharp/.github/workflows/publish.yml`

- [ ] **Step 1: Criar o arquivo C# rebranded**

Criar `sdk/csharp/DebugAssist.cs`:

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace DebugAssistSDK
{
    /// <summary>
    /// DebugAssist SDK for C# — auto-captures unhandled exceptions and reports them to DebugAssist.
    ///
    /// Usage (one line in Program.cs):
    ///   DebugAssist.EnsureInitialized();
    ///
    /// Or with explicit key:
    ///   DebugAssist.Init("YOUR_API_KEY", "my-project");
    ///
    /// Configuration via env vars:
    ///   DEBUG_ASSIST_API_KEY   — your API key
    ///   DEBUG_ASSIST_BASE_URL  — base URL (default: https://api.debug-assist.app)
    ///   DEBUG_ASSIST_PROJECT   — project name (default: unknown)
    ///   DEBUG_ASSIST_ENABLED=0 — disable SDK
    /// </summary>
    public static class DebugAssist
    {
        private static string _apiKey      = Environment.GetEnvironmentVariable("DEBUG_ASSIST_API_KEY") ?? string.Empty;
        private static string _baseUrl     = (Environment.GetEnvironmentVariable("DEBUG_ASSIST_BASE_URL") ?? "https://api.debug-assist.app").TrimEnd('/');
        private static string _projectName = Environment.GetEnvironmentVariable("DEBUG_ASSIST_PROJECT") ?? "unknown";
        private static bool   _enabled     = Environment.GetEnvironmentVariable("DEBUG_ASSIST_ENABLED") != "0";
        private static bool   _initialized = false;
        private static readonly object _lock = new object();

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

                _http.Send(request);
            }
            catch (Exception e)
            {
                Console.Error.WriteLine($"[DebugAssist] Falha ao enviar diagnóstico: {e.Message}");
            }
        }
    }
}
```

- [ ] **Step 2: Atualizar `sdk/csharp/DebugAssist.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net6.0</TargetFramework>
    <RootNamespace>DebugAssistSDK</RootNamespace>
    <AssemblyName>DebugAssist</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <Version>1.0.0</Version>
    <PackageId>DebugAssist</PackageId>
    <Title>DebugAssist SDK</Title>
    <Description>Auto-capture runtime errors and send diagnostics to DebugAssist API</Description>
    <PackageProjectUrl>https://github.com/debug-assist/sdk-csharp</PackageProjectUrl>
    <RepositoryUrl>https://github.com/debug-assist/sdk-csharp</RepositoryUrl>
    <RepositoryType>git</RepositoryType>
    <PackageLicenseExpression>MIT</PackageLicenseExpression>
    <PackageTags>debug;monitoring;error-tracking;diagnostics</PackageTags>
    <Authors>DebugAssist</Authors>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
  </PropertyGroup>
</Project>
```

- [ ] **Step 3: Verificar que compila**

```bash
cd sdk/csharp
dotnet build --configuration Release
```

Esperado: Build succeeded, 0 Warning(s), 0 Error(s)

- [ ] **Step 4: Criar `sdk/csharp/README.md`**

```markdown
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
```

- [ ] **Step 5: Criar `sdk/csharp/.github/workflows/publish.yml`**

```yaml
name: Publish to NuGet

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0'

      - name: Build
        run: dotnet build --configuration Release

      - name: Pack
        run: dotnet pack --configuration Release --no-build --output nupkgs

      - name: Push to NuGet
        run: dotnet nuget push nupkgs/*.nupkg --api-key ${{ secrets.NUGET_API_KEY }} --source https://api.nuget.org/v3/index.json
```

- [ ] **Step 6: Remover arquivo antigo e commitar**

```bash
rm sdk/csharp/DevInsight.cs
git add sdk/csharp/
git commit -m "feat(sdk-csharp): rebrand para DebugAssist + csproj NuGet + CI"
```

---

## Task 7: Checklist de passos manuais (não automatizáveis)

Estes passos precisam ser feitos manualmente pelo usuário antes de fazer o primeiro release.

- [ ] **Criar org no GitHub:** Acessar https://github.com/organizations/new e criar `debug-assist`

- [ ] **Criar os 6 repositórios:**
  - `github.com/debug-assist/sdk-python`
  - `github.com/debug-assist/sdk-ruby`
  - `github.com/debug-assist/sdk-php`
  - `github.com/debug-assist/sdk-java`
  - `github.com/debug-assist/sdk-go`
  - `github.com/debug-assist/sdk-csharp`

- [ ] **Copiar conteúdo de cada `sdk/<lang>/` para o repositório correspondente** (ou fazer push inicial)

- [ ] **Configurar segredos em cada repositório** (Settings → Secrets → Actions):

  | Repositório | Segredo | Como obter |
  |-------------|---------|------------|
  | sdk-python | `PYPI_API_TOKEN` | pypi.org → Account Settings → API tokens |
  | sdk-ruby | `RUBYGEMS_API_KEY` | rubygems.org → Profile → API Key |
  | sdk-php | `PACKAGIST_TOKEN` | packagist.org → Profile → API Token |
  | sdk-java | `OSSRH_USERNAME` | central.sonatype.com → Account |
  | sdk-java | `OSSRH_PASSWORD` | central.sonatype.com → Account |
  | sdk-java | `GPG_PRIVATE_KEY` | `gpg --export-secret-keys --armor KEY_ID` |
  | sdk-java | `GPG_PASSPHRASE` | A passphrase da sua chave GPG |
  | sdk-csharp | `NUGET_API_KEY` | nuget.org → Account → API Keys |

- [ ] **Maven Central — aprovação do namespace:**
  1. Criar conta em https://central.sonatype.com
  2. Fazer login e ir em "Add Namespace"
  3. Adicionar `io.github.debug-assist` — a verificação é automática via GitHub
  4. Aguardar aprovação (geralmente imediata para namespaces `io.github.*`)

- [ ] **Packagist — registrar o pacote PHP:**
  1. Criar conta em https://packagist.org
  2. Submit Package → URL: `https://github.com/debug-assist/sdk-php`
  3. O webhook já é configurado automaticamente pelo Packagist

- [ ] **Fazer o primeiro release em cada repositório:**
  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```
  Isso dispara o workflow de publicação em cada repositório.

---

## Notas

- A URL `https://api.debug-assist.app` é um placeholder — atualizar em todos os SDKs quando o domínio for configurado (itens 1-2 da lista de tarefas)
- Go não precisa de workflow de publicação: após criar `github.com/debug-assist/sdk-go`, qualquer tag é indexada automaticamente pelo `pkg.go.dev`
- Maven Central é o registro mais trabalhoso — GPG + aprovação de namespace. Priorizar a criação da conta e namespace antes do primeiro deploy
