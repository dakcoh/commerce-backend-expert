# commerce-context-mcp

English · [한국어](https://github.com/dakcoh/commerce-context-mcp/blob/master/docs/INSTALLATION.ko.md)

A local MCP server that helps AI coding tools retrieve Korean ecommerce and Java/Spring design guidance.

**The documentation is available in English; the knowledge catalog is currently Korean.** The server does not translate queries. Ask your AI client to search with relevant Korean terms and explain the results in your preferred language. English query quality has not been established by the current regression suite.

## How it helps

- Use the catalog's 70 Korean ecommerce rules as shared checks for designs and code reviews.
- Review failure and recovery flows, including duplicate requests, unknown payment outcomes, and partial refunds.
- Read applicability, exceptions, recorded references, and review status before applying guidance to your code.

Describe the business scenario and provide the relevant code to your connected AI client. See [Use the server](#use-the-server) for an example.

## Requirements

Version 0.2.2 requires **Node.js 22 or later and a local STDIO MCP client**. You do not need to install a JDK/JRE or configure `JAVA_HOME`. An existing system Java installation is not used.

**The first launch prepares a private Temurin JRE 21.0.12.1+1.** This does not depend on npm installation scripts; installation with `--ignore-scripts` is supported. Automatic runtime preparation is available **from 0.2.0**. Update older packages. For unpublished source changes, use the [local package validation procedure](https://github.com/dakcoh/commerce-context-mcp/blob/master/CONTRIBUTING.md#local-validation).

Supported platforms are Windows, macOS, and glibc-based Linux on x64 and ARM64, selected according to the Node process architecture. Release CI checks actual startup, recovery, and shutdown on these platforms. Linux musl/Alpine and 32-bit systems are unsupported. Extraction requires the OS `tar` command, included with Windows 10/11 and macOS.

On Windows, Unicode runtime paths use a verified junction. JARs in Unicode caches are copied to a private workspace and removed on shutdown. If the temporary path contains non-ASCII characters, these workspaces use `.commerce-context-mcp-java` and `.commerce-context-mcp-launch` in your user home instead. This avoids emoji in TEMP while allowing Korean profiles supported by Windows Java. Administrator access, PowerShell, and 8.3 filename generation are not required. If Windows Java cannot represent your user profile path, use the private ASCII cache override below.

```bash
node -v
npx -y commerce-context-mcp download
npx -y commerce-context-mcp doctor
```

`doctor` checks runtime and JAR caches without downloading. **Both must pass verification for exit code 0**; missing or damaged caches produce exit code 1. Before first launch, `not prepared` or `cached jar: missing` means preparation is needed. Run `download` and check again. `download` or server startup also checks whether the runtime can actually execute with the available OS libraries.

## Connect a client

Choose the method for your client.

**Codex CLI** — [official documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

```bash
codex mcp add commerce-context -- npx -y commerce-context-mcp
```

**Claude Code** — [official documentation](https://code.claude.com/docs/en/mcp)

```bash
claude mcp add --transport stdio commerce-context -- npx -y commerce-context-mcp
```

**Clients using JSON configuration, including Cursor and Claude Desktop**

Merge the following entry into your existing `mcpServers` configuration. Follow your client's instructions for its configuration location and command execution requirements.

```json
{
  "mcpServers": {
    "commerce-context": {
      "command": "npx",
      "args": ["-y", "commerce-context-mcp"]
    }
  }
}
```

Refresh the connection or restart the app, then check that the tools are enabled. Confirm you configured the app you actually use; a CLI and its desktop app can have separate settings.

## Use the server

> “Use commerce-context to review signature checks, duplicate-event handling, and failure recovery in this payment webhook. Search the Korean catalog and explain applicability and remaining checks in English.”

On first launch, the package retrieves the JAR matching its version and the release checksum, verifies SHA-256, and stores them under `~/.commerce-context-mcp`. The private JRE is stored under `runtimes/` in the same cache and checked against a pinned SHA-256. Archive paths are validated before extraction. Cached runtime files are checked on later launches and repaired if damaged. Once preparation succeeds, subsequent launches need no runtime or JAR download.

The server needs no separate LLM API key or database. AI usage charges and data transmission depend on your connected client's terms and settings. Search match is not factual accuracy; neither an empty result nor a review candidate establishes whether a defect exists. If `partial` or `analysisTruncated` is true, narrow the scope and check again.

[Usage scenarios, result interpretation, and all 70 rules](https://github.com/dakcoh/commerce-context-mcp/blob/master/docs/USAGE_SCENARIOS.md)

## Troubleshooting

| Symptom | Next step |
|---|---|
| `Managed Java ... cannot run` | Check supported OS/CPU and OS libraries, then run `download`. Stop existing MCP processes if files are locked. |
| Windows Java fails on the user profile path | Set `COMMERCE_CONTEXT_CACHE_DIR` to a writable, private ASCII path and retry. Unicode TEMP alone no longer blocks startup. |
| `Cannot extract Java runtime` | Check the OS `tar` command and available disk space. |
| `Unsupported Java runtime platform` | Check supported OS/CPU and Node architecture. |
| `npx` cannot be found | Check the Node installation and the app's command environment, then restart the app. |
| The command keeps running | The server may be waiting for MCP input. Register it as your client's server command. |
| Download or checksum failure | Check access to GitHub Release assets and retry. Do not disable verification. |
| Windows cache lock reports `EPERM` | Let other preparation processes finish, then retry `download`. If it persists, check write access to the cache path reported by `doctor`. |
| Lock wait timed out | Check whether another process is preparing the same version. Do not remove an active lock. |
| The AI does not use the tools | Check connection and tool permissions, then explicitly ask the AI to consult the server. |

First retry `download`. Damaged runtime files can be restored from the cached, pinned archive. If the archive is also damaged, it is downloaded again. Offline runtime repair works with an intact archive even if its checksum sidecar is missing. Offline JAR use requires both the JAR and its `.sha256` file.

If automatic recovery fails, stop related MCP clients and download processes. Inspect only the paths reported by `doctor`. `runtime executable` points to a file inside the affected version's `runtimes/temurin-<version>-<OS>-<CPU>` directory. Remove only that version's runtime directory or the affected JAR and `.sha256`, then run `download`. For a persistent lock error, remove only the relevant `.lock` after confirming no active download exists. Do not delete unrelated versions or directories.

If Windows Java cannot run from your user profile path (for example, characters unsupported by its Windows codepage), use a private cache path containing only ASCII characters. Replace the example with an absolute path writable by your account, and set the same variable in the MCP client's environment. Avoid shared or publicly writable folders.

```powershell
$env:COMMERCE_CONTEXT_CACHE_DIR="C:\path\to\private-cache"
npx -y commerce-context-mcp download
```

## Commands and download timing

```bash
npx -y commerce-context-mcp --help
npx -y commerce-context-mcp --version
npx -y commerce-context-mcp download
```

npm installation installs only launcher files. `download` prepares the private Java runtime and JAR, then exits. Running without a command performs the same preparation and waits for an MCP connection. [Plugin installation packaging](https://github.com/dakcoh/commerce-context-mcp/blob/master/CONTRIBUTING.md#plugin-installation-package) is planned.

Runtime binaries come from the [official Eclipse Temurin release](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1). Project code is MIT licensed. The runtime has its own [OpenJDK license](https://adoptium.net/about/) and notices under `legal/` in the archive. Runtime security updates are delivered through new npm releases that update the pinned version and checksums.

[Project](https://github.com/dakcoh/commerce-context-mcp) · [Contributing and roadmap](https://github.com/dakcoh/commerce-context-mcp/blob/master/CONTRIBUTING.md) · [MIT](LICENSE)
