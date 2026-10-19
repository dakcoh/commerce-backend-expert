const {ensureRuntime, runtimeInfo, runtimePaths, verifiedRuntime} = require("./managed-runtime");
const { releaseInfo } = require("./release-client");
const { cachePaths, ensureJar, verifyCached } = require("./jar-cache");
const { startServer } = require("./server-process");

function usage(pkg) {
  console.log(`commerce-context-mcp ${pkg.version}

Usage:
  commerce-context-mcp [--help]
  commerce-context-mcp [--version]
  commerce-context-mcp download
  commerce-context-mcp doctor

With no command, prepares a private Java 21 runtime and the release JAR, then
starts the MCP server over stdio. No system Java or JAVA_HOME is required.
The download command prepares both caches; doctor checks them without downloads.`);
}

async function run(args, pkg, dependencies = {}) {
  const info = releaseInfo(pkg);
  const paths = cachePaths(info, dependencies.cacheDir);
  const command = args[0];
  if (command === "--help" || command === "-h") {
    usage(pkg);
    return;
  }
  if (command === "--version" || command === "-v") {
    console.log(pkg.version);
    return;
  }
  if (command === "doctor") {
    doctor(pkg, info, paths);
    return;
  }

  const javaPath = await ensureRuntime({cacheDir: paths.cacheDir});
  const jarPath = await ensureJar(info, { cacheDir: dependencies.cacheDir });
  if (command === "download" || command === "--download-only") {
    return;
  }
  console.error("Starting MCP server over stdio. This process stays running while the MCP client is connected.");
  process.exitCode = await startServer(jarPath, paths.cacheDir, args, {javaPath});
}

function doctor(pkg, info, paths) {
  const runtime = runtimeInfo();
  const managed = runtimePaths(paths.cacheDir, runtime);
  const runtimeReady = verifiedRuntime(managed, runtime);
  const cached = verifyCached(paths);
  console.log(`package: ${pkg.name}@${pkg.version}`);
  console.log(`managed java: ${runtimeReady ? "verified" : "not prepared or damaged"} (${runtime.version})`);
  console.log(`runtime executable: ${managed.javaPath}`);
  if (!runtimeReady) console.log("Run commerce-context-mcp download to prepare the private runtime and server.");
  console.log(`release asset: ${info.releaseUrl}`);
  console.log(`release checksum: ${info.checksumUrl}`);
  console.log(`cached jar: ${cached.ok ? `verified (${paths.jarPath})` : cached.reason}`);
  process.exitCode = runtimeReady && cached.ok ? 0 : 1;
}

module.exports = { run, usage, doctor };
