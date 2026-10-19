const { assertJava, javaStatus } = require("./java-runtime");
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

With no command, downloads and verifies the release JAR if needed, then starts
the MCP server over stdio using Java 17 or newer.`);
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

  assertJava();
  const jarPath = await ensureJar(info, { cacheDir: dependencies.cacheDir });
  if (command === "download" || command === "--download-only") {
    return;
  }
  console.error("Starting MCP server over stdio. This process stays running while the MCP client is connected.");
  process.exitCode = await startServer(jarPath, paths.cacheDir, args);
}

function doctor(pkg, info, paths) {
  const status = javaStatus();
  const cached = verifyCached(paths);
  console.log(`package: ${pkg.name}@${pkg.version}`);
  console.log(`java: ${status.ok ? "ok" : "missing or too old"}`);
  if (status.output) {
    console.log(status.output.split(/\r?\n/)[0]);
  }
  console.log(`release asset: ${info.releaseUrl}`);
  console.log(`release checksum: ${info.checksumUrl}`);
  console.log(`cached jar: ${cached.ok ? `verified (${paths.jarPath})` : cached.reason}`);
  if (!status.ok) {
    process.exitCode = 1;
  }
}

module.exports = { run, usage, doctor };
