# Contributing, development, and releases

English · [한국어](CONTRIBUTING.ko.md)

For usage, start with the [README](README.md). For installation problems, see the [installation guide](npm/README.md). This document covers changes to code, knowledge, documentation, and releases.

[Development environment](#development-environment) · [Knowledge changes](#editing-knowledge) · [Validation](#local-validation) · [Runtime policy](#private-java-runtime-policy) · [Server contract](#server-architecture-and-contract) · [AI evaluation](#evaluating-real-ai-workflows) · [Roadmap](#next-improvements) · [Releases](#release-checks)

## Commitments to users

- Provide general Korean ecommerce guidance and Java/Spring implementation choices.
- Distinguish search candidates from confirmed defects, and search match from evidence quality.
- Preserve applicability, exceptions, and review status in responses.
- Never invent review dates, reviewers, or evidence.
- Keep company-specific policies, contracts, customer data, and keys out of public knowledge and examples.

English documentation does not make the catalog multilingual. Knowledge and most tested search expressions are Korean. Preserve executable Korean examples until a separately evaluated English catalog or query strategy exists.

## Development environment

| Item | Current requirement |
|---|---|
| Build JDK | Java 21 toolchain; application class-file major version 65 |
| npm execution | Automatically prepared private Temurin JRE 21; no system Java |
| Direct JAR execution | Java 21 or later |
| Node.js | 22 or later; representative checks on 22 and 24 |
| Server | STDIO, YAML inside the JAR; no external HTTP server, database, or LLM |

npm users get an automatically prepared runtime. Developers building from source need JDK 21. Direct JAR execution uses the Java executable selected by the developer.

Keep dependencies directed `adapter → application → core`. Do not introduce Spring, MCP, Jackson, or file I/O into core. Prefer the existing four tools over a tool per static rule. Do not add Tomcat, Spring Web, or Actuator to this STDIO server.

## Editing knowledge

The source of truth is the YAML under [src/main/resources/knowledge](src/main/resources/knowledge). Keep rule IDs stable. Explain changes, applicability, failure cases, and recovery.

```yaml
schema-version: 1
domain: example
governance:
  owner: example-maintainers
rules:
  - id: example-rule
    category: security
    title: "Rule title"
    summary: "Applicability and the main decision"
    severity: high
    applicability:
      applies-when: ["Applicable condition"]
      does-not-apply-when: ["Excluded condition"]
      assumptions: ["Assumption"]
      jurisdiction: KR
    guidance: ["Guidance including failure and recovery"]
    checklist: ["A question to verify"]
    tags: [example]
```

This illustrates the schema; it is not a proposed production rule. High and Critical rules become `needs-review` when applicability, explicit evidence, or actual review records are insufficient. Setting `status: active` does not bypass that check.

Only add review records after an actual review:

```yaml
review:
  last-reviewed-at: 2026-07-21
  verified-by: actual-reviewer
  change-note: "Scope checked and reason for the change"
```

For official sources you actually checked, use the following structure. Replace dates and reviewer values with real records and omit inapplicable optional fields.

```yaml
evidence:
  - title: "Document checked"
    url: "https://official.example/document"
    type: official-documentation
    source-version: "Version checked"
    published-at: 2026-01-15
    reviewed-at: 2026-07-21
    accessed-at: 2026-07-21
    note: "Applicability and scope checked"
```

Validation rejects duplicate fields or IDs, invalid references, empty required values, incomplete review records, invalid dates, and future dates. External HTTP(S) evidence needs an access date. Blogs, AI answers, and project YAML paths are not official evidence. Do not encode a provider status code, timeout, tax rate, or retention period as a universal constant.

## Local validation

`npm test` uses the standard Node test runner to check basic behavior, cache locks, downloads, process shutdown, package contents, and JRE recovery. Keep scenario data in its test file; temporary directory cleanup and system-Java isolation are shared in `npm/test/support/fixtures.js`. Use `temporaryDirectory(prefix, t)` to register cleanup before fixture setup can fail. This helper is excluded from the npm package. To check one area, run a command such as `node --test npm/test/runtime.test.js` from the repository root.

Run these commands from the repository root in PowerShell. Replace `JAVA_HOME` with your JDK 21 path. This JDK is for source builds, separate from the npm user's private runtime.

```powershell
$env:JAVA_HOME="C:\path\to\jdk-21"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat clean validateKnowledge bootJar "-Pversion=0.2.1" --no-daemon
npm.cmd --prefix npm test
$env:MCP_EXPECTED_VERSION="0.2.1"
node npm/test/mcp-smoke.js build/libs/context-engine-0.2.1.jar
```

To check real JRE download, two-process preparation, offline reuse, and corruption repair:

```powershell
node npm/test/runtime-smoke.js
```

This test uses a private temporary cache and removes Java from child-process `PATH`. It downloads the official JRE, so it needs network access and disk space.

Before publication, validate the **local package**. Running `npx commerce-context-mcp` against unpublished source changes executes the registry package instead.

```powershell
Push-Location npm
npm.cmd pack --ignore-scripts --json --pack-destination ../build > ../build/npm-pack.json
Pop-Location
New-Item -ItemType Directory -Force build/packed | Out-Null
tar -xzf build/commerce-context-mcp-0.2.1.tgz -C build/packed
$env:MCP_LAUNCHER_ROOT=(Resolve-Path build/packed/package).Path
node npm/test/mcp-smoke.js build/libs/context-engine-0.2.1.jar
Remove-Item Env:\MCP_LAUNCHER_ROOT
Remove-Item Env:\MCP_EXPECTED_VERSION
```

The package smoke test places the locally built JAR in a temporary cache, prepares the private JRE without system Java, invokes MCP, checks a Korean/Unicode cache path, and verifies shutdown after EOF. Cold download of the published JAR is a separate release-workflow check. To check installation without scripts, run `npm.cmd install --ignore-scripts --no-audit --no-fund --prefix build/local-install ./build/commerce-context-mcp-0.2.1.tgz`.

On Linux/macOS, configure JDK 21 and use `./gradlew` and `npm`. Real OS signal tests run on Linux/macOS; distinguish these results from Windows skips.

| Change | Checks |
|---|---|
| YAML and trust metadata | 70 rules, schema, applicability, evidence, review status, duplicate-field rejection |
| Search | Existing 100 queries, new expressions, irrelevant queries, ranking, and counts; do not silently change expected IDs |
| Review and checklists | Existing 20 review, 10 checklist, and 15 trust cases; preserve conditions, items, and partial-result reporting |
| MCP | Four tools, three resource types, two prompts, recovery after invalid input, actual JSON-RPC |
| Launcher | No-Java PATH, two processes, offline repair, missing checksum sidecars, doctor exit codes, EOF, child exit, npm pack contents |
| Documentation | Run JSON examples through MCP smoke; compare all 70 IDs, local links and anchors, and local versus published instructions |

`validateKnowledge` depends on the complete Java test suite. Run actual-JAR MCP smoke and npm checks separately. Policy tests are not live payment-provider, bank, or database concurrency/failure tests. Tool selection, final AI answers, and token comparisons need [separate evaluation](#evaluating-real-ai-workflows).

## Upgrading

If prompts or automation directly invoke the old domain-specific tools, use these replacements. The server's `npx` invocation stays the same.

| Previous | Current |
|---|---|
| `search_*_knowledge`, `search_all_knowledge` | `search_knowledge` with an optional domain |
| `get_*_guide`, `get_*_context` | Search, then `get_rule` |
| `get_*_checklist` | `get_checklist` |
| Response `confidence` | `matchConfidence`: search match, not factual accuracy |

From 0.2.0, npm execution needs Node 22 or later and automatically obtains a private JRE 21. Users can run `download` and `doctor`; no Java configuration in `JAVA_HOME` or `PATH` is needed. Source builders configure JDK 21. Java 17 cannot directly execute the new JAR.

## Release checks

A normal push or PR to `master` runs CI. Publishing a GitHub Release triggers validation and publication. The shared [.github/workflows/validate.yml](.github/workflows/validate.yml) builds with JDK 21/Node 22 on Ubuntu and checks the same artifacts with JDK 21/Node 24 on Ubuntu and JDK 21/Node 22 and 24 on Windows. Private runtimes are also checked on Windows ARM64, Ubuntu ARM64, and macOS Intel/ARM64. Package smoke tests leave only extraction tools on `PATH` and use a nonexistent `JAVA_HOME`.

- Check Java, knowledge, npm, and actual MCP regression results.
- Match npm, tag, manifest, and `serverInfo` versions; verify application major version 65.
- Check JAR YAML and forbidden web-server dependencies, all 13 tarball files and their contents/integrity, and bundle hashes.
- Check Unicode caches, Java exit after EOF, and Linux signals on supported platforms.
- Match public documentation to actual code and packaged files.

Publication order: check an unused npm version, tag commit, and authentication; upload the tested JAR/checksum; download and compare them; publish **the tested tarball itself** with provenance. Verify the registry afterward. Never reuse a published version or assume a working tree equals a registry package because their version strings match.

Do not overwrite existing assets. GitHub and npm publication is not atomic: inspect remaining assets and registry state before retrying a failure. The workflow does not automatically delete assets, overwrite them, or increment versions. Check `NPM_TOKEN` permissions/expiry and any external Trusted Publisher registration separately. The current workflow's OIDC permission is for provenance.

### Staged npm publication

Release 0.2.0 used staged publication after the token required approval. The checked-in workflow still uses direct `npm publish`; it does not automatically handle `E_STAGE_REQUIRED`. Use a controlled staging job with the validated bundle when approval is required.

Staging needs npm CLI 11.15+ and Node 22.14+. In the authenticated CI environment, verify the sealed bundle, then submit the same tarball, with `VERSION` and `NPM_TAG` set from validation:

```bash
node scripts/release-checks.js verify
cd npm
npm stage publish "../build/release/commerce-context-mcp-$VERSION.tgz" --ignore-scripts --provenance --access public --tag "$NPM_TAG"
```

Record the stage ID. A maintainer reviews the version, tag, and artifact, then chooses **Staged Packages → Approve** on npm and completes 2FA. Staging alone is not public publication. After approval, verify the registry version/tag/integrity, install it afresh, and test without system Java. See [npm's staged publishing guide](https://docs.npmjs.com/staged-publishing/).

`runtime-inventory.tsv` lists embedded libraries and hashes. It is not a standard SBOM or a vulnerability verdict. Report local validation, remote CI, and actual publication as separate results.

## Reporting problems and describing changes

Include the query or rule ID, relevant scenario, reproducible input, expected output, and actual output. For knowledge changes, record official sources actually checked, their dates, and applicability. Validate the [usage examples](docs/USAGE_SCENARIOS.md) through actual MCP calls; do not paste private company material.

Keep each change focused on one purpose. Describe checks performed and remaining limits. Commit, push, publication, and deployment stay within the requested scope.

## Server architecture and contract

Flow: AI client → STDIO MCP → search/checklist/review → YAML. Knowledge is loaded into immutable objects on startup. Retrieval uses no external LLM, database, or HTTP server. The connected AI client handles final answers and data transmission.

The current handlers only read in-memory knowledge. `McpSyncServerCustomizer.immediateExecution(true)` runs them sequentially on the STDIO input thread, avoiding the SDK 0.18 [concurrent response loss issue](https://github.com/modelcontextprotocol/java-sdk/pull/935). MCP smoke sends 64 concurrent tool calls in each of four rounds. Revisit this execution model before adding external I/O or changing transports.

| Location | Responsibility |
|---|---|
| core/model and port | Knowledge models and interfaces |
| application | Search, review candidates, and checklist composition |
| adapter/in/mcp | Tools, resources, prompts, and input-schema validation |
| adapter/out/yaml and render | YAML loading/validation and Markdown rendering |

Public tools: `search_knowledge`, `get_rule`, `get_checklist`, `review_commerce_design`. Resources: `commerce://catalog`, `commerce://domains/{domain}`, `commerce://rules/{ruleId}`. Prompts: `review-commerce-api`, `review-payment-webhook`.

- Search/review default to five results, at most ten. Checklists select at most ten rules.
- Search normalizes NFKC, selected Korean particles/inflections, and aliases. It uses at most 32 distinct terms and field match ratios; ties are ordered by domain, category, and ID.
- Code review excludes package/import lines and searches the original input and scenario separately. Long input adds at most 32 overlapping 16-word windows, reporting sampled analysis for larger inputs. It does not execute code or parse an AST.
- Checklists deduplicate only items with the same conditions and trust context. JSON and Markdown preserve items and order.
- Search/rule/checklist accept `responseFormat` `json` or default `both`. JSON keeps `markdown` empty; search with JSON and `detail: "full"` supplies `fullRules`. Use `get_rule` to inspect conditions for summary candidates; rules already included in full results need no repeat lookup. Review does not accept this option.
- Search/review domains accept CSV; checklist accepts one domain. Required values, types, enums, bounds, unknown filters, and empty CSV elements are validated. Enums normalize case and whitespace.
- Empty or valid unrelated queries return no results after option validation. Tool failures use `isError`; resources use JSON-RPC errors. A subsequent valid request still works.
- Tool callbacks return text JSON. Native `outputSchema`, `structuredContent`, and annotation support are future work.

### Transfer, cache, and shutdown boundaries

The launcher downloads the JAR matching its npm version over HTTPS and verifies SHA-256. A checksum detects corruption; it does not replace a publisher signature.

Java stdout is read through a separate pipe and forwarded through Node streams. This prevents truncated Java output when inherited stdout is nonblocking and the client reads slowly. Stream backpressure controls forwarding. MCP smoke pauses reads during concurrent responses to check JSON and UTF-8 integrity.

| Item | Current limit |
|---|---|
| Checksum | 15 seconds overall; 64 KiB |
| JAR | 120 seconds per attempt; at most three attempts |
| Request inactivity | 15 seconds; redirects share the overall deadline |
| JAR lock wait/reacquisition | Shares the original 405-second budget; not a forced cutoff of an active transfer |
| Private JRE preparation | Shares an initial 600-second budget; transfers 120 seconds per attempt, at most three; extraction 90 seconds |
| doctor | No download; exit 0 only if both runtime and JAR caches verify, otherwise 1 |
| EOF/shutdown | Close the owned Java child's stdin and allow up to two seconds; forward signals to that child |

Locks check PID, hostname, and a token. Only dead local owners are reclaimed. Ambiguous, foreign-host, or active owners are not removed automatically. Losing ownership stops publication; a process can reacquire within the remaining budget or use the verified winner's cache. Duplicate transfers remain possible; shared disks do not have a strict mutual-exclusion guarantee.

Temporary files are cleaned up. Signal exits use 130/143; normal shutdown preserves the child code. Cleanup is not guaranteed after power loss or a forced launcher kill.

## Private Java runtime policy

Preparation runs on first launch or `download`, without npm installation scripts.

- **Distribution:** Eclipse Temurin JRE **21.0.12.1+1**, from its [official release](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1). `npm/lib/runtime-manifest.json` pins URLs, official SHA-256 values, and sizes for six OS/CPU combinations. There is no runtime lookup of latest or reuse of system Java.
- **License:** Preserve [OpenJDK GPLv2 with Classpath/Assembly Exceptions](https://adoptium.net/about/) and the runtime's `legal/` notices. npm contains no runtime binaries; they come from the official supplier.
- **Environment:** Windows/macOS/glibc Linux, x64/ARM64; reject musl and 32-bit systems. Use OS `tar`, addressed directly under System32 on Windows. Extraction uses a destination cwd and relative archive arguments. Windows runtime paths use a private ASCII junction. JARs in Unicode caches run from a private ASCII temporary copy, removed when the child exits; the original cache stays intact. Allow temporary space for one JAR. Verify junction targets. Administrator access, PowerShell, and 8.3 names are not required. If no ASCII alias can be created, use a private ASCII `COMMERCE_CONTEXT_CACHE_DIR`. JVM diagnostics go to stderr to preserve JSON-RPC stdout. System Java installation and settings are unchanged.
- **Cache:** Under `~/.commerce-context-mcp/runtimes/`, by version/platform. Check the pinned hash and archive paths/links before extracting into a temporary directory. Only internal symlinks to regular files are allowed. Record file hashes and execution permissions and revalidate on every launch. Retain the archive for offline repair.
- **Recovery:** Reuse PID/hostname/token locks. Keep the original 600-second budget across ownership changes, 120-second transfer attempts (at most three), and 90-second extraction. Clean abandoned temporary files/directories only after ownership checks. Log to stderr; execute Java by absolute path.
- **Security updates:** Check Temurin security/patch releases, update the pinned version and all six archive hashes/sizes, run unit and actual-package tests on supported platforms, and publish a new npm version. Old caches are not reused for another version or automatically bulk-deleted while they might be in use.
- **Local measurement:** On Windows x64, 2026-10-19: 49.0 MB JRE download, 200.6 MB cache including the archive, 2.6 seconds initial runtime preparation, 0.4 seconds revalidation. JAR preparation is separate; these are not guaranteed timings. Actual startup and recovery were checked locally on Windows/Ubuntu x64; macOS/ARM64 execution is checked separately in release CI.

A successful `doctor` means cache integrity passed. `download` also checks the selected JRE executes; complete MCP smoke checks connection, tools, and shutdown. Runtime archives use pinned SHA-256, so a lost runtime checksum sidecar does not block offline repair. The server JAR still needs its release `.sha256`.

## Evaluating real AI workflows

Separate server regression from an AI's task success. Reduced JSON bytes are not a measured token or cost reduction. Normal execution and CI do not automatically run paid LLM evaluations.

The 12 development tasks are in [ai-workflows.json](npm/test/fixtures/ai-workflows.json). Use these synthetic artifacts rather than company code, customer data, or real keys.

1. Record client, model, version, and settings. Give each task and artifact to a new conversation without forcing tool-call order.
2. Record actual tool names/arguments/results, final answers, and observable tokens/time as JSONL. Use null for unobserved tokens; do not collect private reasoning.
3. Use `humanChecks` for a person's review. For an AI review, set `reviewType: "agent"` and use `agentChecks`. Record actual `reviewedBy`/`reviewedAt`; do not label AI review as human review. Include all 12 tasks per combination. Three repetitions per task are recommended for an initial comparison; report actual counts.
4. Compare applicability/evidence preservation, unsupported assertions, partial-result handling, recovery, and efficiency. Keep development expressions separate from final evaluation queries.

This incomplete example illustrates the format; empty results and review fields do not establish a successful evaluation. Actual JSONL stores one object per line.

```json
{
  "taskId": "AI-01",
  "model": "Actual model and version",
  "client": "Actual client",
  "run": 1,
  "toolCalls": [
    {
      "name": "search_knowledge",
      "arguments": {"query": "결제 웹훅 서명", "responseFormat": "json"},
      "result": {}
    }
  ],
  "finalAnswer": "Actual final answer",
  "inputTokens": null,
  "outputTokens": null,
  "elapsedMs": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "humanChecks": {}
}
```

Put the actual MCP result or parsed response in result. The grader checks relevant rules and recorded review outcomes without forcing a particular call sequence. When execution status is available, also record `executionCode` and `turnCompleted`. Failed or incomplete executions fail regardless of review scores.

For AI review, each rubric entry in `agentChecks` contains `{ "passed": true, "quote": "Exact text from the final answer", "rationale": "Reason for the judgment" }`. A missing answer quote or empty rationale leaves the review pending. Omitting `reviewType` preserves the existing human review format. AI-12 requires an actual failed call followed by success; Codex records with `status: "failed"` also count as errors.

Run from the repository's npm folder, replacing the path with your actual transcript:

```powershell
cd npm
npm.cmd run test:ai-eval -- "C:\path\reviewed-transcripts.jsonl"
```

Exit code 0 means supplied records passed and required cases are complete; 1 means failed/invalid input; 2 means review or cases are missing and judgment is pending. Results identify human or AI review with `reviewType`. Synthetic grader tests are not model performance results. The grader cannot establish judgment accuracy or reviewer identity.

On 2026-10-20, all 12 cases ran once on Windows x64 with Codex CLI 0.163.0 and gpt-6.1-sol (high), passing AI review with quotes from actual answers. AI-12 explicitly injected invalid inputs to test recovery. After correcting guidance that encouraged duplicate full-rule lookups, additional AI-11/12 runs used 19→11 and 7→2 calls. These are limited observations from one model, not evidence of other clients/models, general token/time savings, or independent human validation.

## Next improvements

**Java 21 builds and automatic private JRE preparation are implemented.** npm users prepare Node 22 or later. Plugin distribution and real-AI comparisons remain future work.

| Order | User-visible behavior | Completion criteria |
|---|---|---|
| 1. Private runtime (implemented) | Download, verify, cache, and reuse Java 21 | Startup without system Java; per-platform corruption, interruption, and concurrent preparation recovery; no PATH or administrator changes |
| 2. Java 21 baseline (implemented) | Clear build/runtime requirements | Version, toolchain, artifacts, CI, documentation, and upgrade guide agree; knowledge/MCP contracts remain compatible |
| 3. Connection and evaluation | Client guidance, optional plugin packaging, real-AI comparisons | Verify client installation/activation; evaluate real task records and separate held-out expressions |

User projects reviewed through MCP do not need to migrate to Java 21. Runtime migration alone does not establish better knowledge accuracy or speed.

Evaluate native MCP metadata only after checking text-response compatibility and actual benefit without duplicating tools. Design private-knowledge loading separately from public repository/package contents. Multilingual knowledge/search, country filters, paid plans, and private-repository conversion are separate work; this documentation translation does not implement them.

Remote CI, macOS/ARM64 execution, real-AI evaluation, public GitHub JAR downloads, and npm publication/provenance are separate from local Windows/Ubuntu results. Commit, push, publication, and deployment require the corresponding requested scope.
