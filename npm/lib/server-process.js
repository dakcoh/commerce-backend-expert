const { spawn } = require("child_process");
const { constants } = require("os");
const path = require("path");
const fs = require("node:fs");
const os = require("node:os");

function serverWorkspace(jarPath, cacheDir) {
  if (/^[\x20-\x7e]+$/.test(cacheDir)) return {directory: cacheDir, jar: path.relative(cacheDir, jarPath), cleanup() {}};
  const root = path.join(os.tmpdir(), `.commerce-context-mcp-launch${process.getuid ? `-${process.getuid()}` : ""}`);
  if (!/^[\x20-\x7e]+$/.test(root)) throw new Error("Set COMMERCE_CONTEXT_CACHE_DIR to a private writable ASCII-only path.");
  fs.mkdirSync(root, {recursive: true, mode: 0o700});
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink() || (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o077)))) {
    throw new Error("Java workspace root must be a private directory owned by the current user");
  }
  const directory = fs.mkdtempSync(path.join(root, "run-"));
  const cleanup = () => {
    if (path.dirname(path.resolve(directory)) !== path.resolve(root)) throw new Error("Java workspace cleanup escaped root");
    fs.rmSync(directory, {recursive: true, force: true});
  };
  try { fs.copyFileSync(jarPath, path.join(directory, "server.jar"), fs.constants.COPYFILE_EXCL); }
  catch (error) { cleanup(); throw error; }
  return {directory, jar: "server.jar", cleanup};
}

function serverArguments(jarPath, args = []) {
  return [
    "-Dfile.encoding=UTF-8",
    "-Xlog:disable",
    "-Xlog:all=warning:stderr",
    "-jar",
    jarPath,
    ...args,
  ];
}

function startServer(jarPath, cacheDir, args = [], dependencies = {}) {
  const input = dependencies.stdin || process.stdin;
  const parent = dependencies.process || process;
  const spawnChild = dependencies.spawn || spawn;
  const killTimeoutMs = dependencies.killTimeoutMs ?? 2_000;
  const workspace = serverWorkspace(jarPath, cacheDir);
  return new Promise((resolve, reject) => {
    // Java resolves native libraries and the JAR against these paths; both must survive Windows codepages.
    let child;
    try {
      child = spawnChild(dependencies.javaPath || "java", serverArguments(workspace.jar, args), {
        stdio: ["pipe", "inherit", "inherit"], cwd: workspace.directory, windowsHide: true,
      });
    } catch (error) { workspace.cleanup(); reject(error); return; }
    let timer;
    let requestedSignal;
    let inputEnded = false;
    let inputError;
    const forceStop = () => {
      if (!timer) timer = setTimeout(() => child.kill("SIGKILL"), killTimeoutMs);
    };
    const onEnd = () => {
      inputEnded = true;
      if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.end();
      forceStop();
    };
    const onSignal = (signal) => {
      requestedSignal = signal;
      child.kill(signal);
      forceStop();
    };
    const onInterrupt = () => onSignal("SIGINT");
    const onTerminate = () => onSignal("SIGTERM");
    const onInputError = (error) => {
      inputError = error;
      child.kill("SIGTERM");
      forceStop();
    };
    const onPipeError = (error) => {
      if (error.code !== "EPIPE" && error.code !== "ERR_STREAM_DESTROYED") onInputError(error);
      else forceStop();
    };
    const cleanup = () => {
      clearTimeout(timer);
      input.unpipe(child.stdin);
      input.pause();
      input.removeListener("end", onEnd);
      input.removeListener("close", onEnd);
      input.removeListener("error", onInputError);
      parent.removeListener("SIGINT", onInterrupt);
      parent.removeListener("SIGTERM", onTerminate);
      workspace.cleanup();
    };
    child.once("error", (error) => {
      cleanup();
      reject(new Error(`Unable to start Java MCP server: ${error.message}`, { cause: error }));
    });
    child.once("close", (code, signal) => {
      cleanup();
      if (inputError) { reject(inputError); return; }
      if (requestedSignal) { resolve(128 + constants.signals[requestedSignal]); return; }
      // EOF is a normal MCP disconnect, including a forced stop of a hung server.
      if (inputEnded && signal === "SIGKILL") { resolve(0); return; }
      resolve(code ?? (128 + (constants.signals[signal] || 1)));
    });
    child.stdin.on("error", onPipeError);
    input.once("end", onEnd);
    input.once("close", onEnd);
    input.once("error", onInputError);
    parent.on("SIGINT", onInterrupt);
    parent.on("SIGTERM", onTerminate);
    if (input.readableEnded || input.destroyed) onEnd();
    else input.pipe(child.stdin);
  });
}

module.exports = { serverArguments, startServer };
