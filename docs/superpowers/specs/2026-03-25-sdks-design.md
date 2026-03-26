# Design: Publicação dos SDKs debug-assist (itens 21–26)

**Data:** 2026-03-25
**Escopo:** Python, Ruby, PHP, Java, Go, C#

---

## Contexto

Os SDKs já existem em `sdk/` com código funcional, mas precisam de:
1. Rebranding completo (`DevInsight` → `DebugAssist`)
2. Arquivos de empacotamento para cada registro
3. Repositórios separados na org GitHub `debug-assist`
4. CI/CD via GitHub Actions para publicação automática por tag

---

## Estrutura de Repositórios

Cada SDK vive em um repositório próprio na org `github.com/debug-assist`:

| Linguagem | Repositório | Registro | Nome do pacote |
|-----------|-------------|----------|----------------|
| Python | `sdk-python` | PyPI | `debug-assist` |
| Ruby | `sdk-ruby` | RubyGems | `debug-assist` |
| PHP | `sdk-php` | Packagist | `debug-assist/debug-assist` |
| Java | `sdk-java` | Maven Central | `io.github.debug-assist:debug-assist` |
| Go | `sdk-go` | pkg.go.dev | `github.com/debug-assist/sdk-go` |
| C# | `sdk-csharp` | NuGet | `DebugAssist` |

---

## Rebranding

Aplicado em todos os SDKs:

- Classes/módulos: `DevInsight` / `devinsight` → `DebugAssist` / `debug_assist`
- URL padrão: `https://devinsight-api.onrender.com` → `https://api.debug-assist.app`
- `groupId` Java: `com.devinsight` → `io.github.debug-assist`
- `go.mod` module: `github.com/devinsight/sdk/go` → `github.com/debug-assist/sdk-go`

---

## Arquivos por SDK

### Python (`sdk-python`)
- `debug_assist.py` — código rebranded
- `pyproject.toml` — substitui `setup.py` (padrão moderno PyPI)
- `README.md`
- `.github/workflows/publish.yml` — publica no PyPI ao criar tag `v*`

### Ruby (`sdk-ruby`)
- `debug_assist.rb` — código rebranded
- `debug-assist.gemspec` — novo
- `README.md`
- `.github/workflows/publish.yml` — publica no RubyGems ao criar tag `v*`

### PHP (`sdk-php`)
- `debug_assist.php` — código rebranded
- `composer.json` — novo
- `README.md`
- `.github/workflows/publish.yml` — configura webhook Packagist; push/tag dispara atualização

### Java (`sdk-java`)
- `src/main/java/io/github/debugassist/DebugAssist.java` — código rebranded
- `pom.xml` — expandido com licença, SCM, developer info (obrigatório Maven Central)
- `README.md`
- `.github/workflows/publish.yml` — assina com GPG e faz deploy via OSSRH

### Go (`sdk-go`)
- `debugassist.go` — código rebranded
- `go.mod` — module `github.com/debug-assist/sdk-go`
- `README.md`
- `.github/workflows/ci.yml` — apenas CI (pkg.go.dev indexa automaticamente via tag)

### C# (`sdk-csharp`)
- `DebugAssist.cs` — código rebranded
- `DebugAssist.csproj` — metadados NuGet completos
- `README.md`
- `.github/workflows/publish.yml` — `dotnet pack` + `dotnet nuget push` ao criar tag `v*`

---

## CI/CD

**Publicação:** tag `v*` (ex: `v1.0.0`) dispara workflow de publicação em cada repo.

**Segredos necessários por repositório:**

| SDK | Segredos GitHub |
|-----|----------------|
| Python | `PYPI_API_TOKEN` |
| Ruby | `RUBYGEMS_API_KEY` |
| PHP | `PACKAGIST_TOKEN` |
| Java | `OSSRH_USERNAME`, `OSSRH_PASSWORD`, `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE` |
| Go | nenhum |
| C# | `NUGET_API_KEY` |

**CI em PRs:** todos os repos rodam lint e teste de importação básica em pull requests.

---

## Observações Importantes

- **Maven Central** exige aprovação inicial do namespace `io.github.debug-assist` via Sonatype OSSRH — leva 1-2 dias. Criar issue em https://issues.sonatype.org após criar a org no GitHub.
- **Go** não precisa de workflow de publicação — basta criar a tag no GitHub. O `pkg.go.dev` indexa automaticamente.
- **Packagist** funciona via webhook no GitHub — após configurar o `composer.json` e o webhook, qualquer tag dispara a atualização.
- A URL `https://api.debug-assist.app` é um placeholder — atualizar quando o domínio estiver configurado (item 1-2 da lista).

---

## O que NÃO está no escopo

- Criar as organizações/repositórios no GitHub (ação manual do usuário)
- Configurar os segredos nos repositórios (ação manual)
- Fazer o request de aprovação no Sonatype OSSRH (ação manual)
- Remover os arquivos originais de `sdk/` neste repositório
