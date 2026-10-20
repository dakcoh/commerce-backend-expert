const { spawn } = require("child_process");
const { constants } = require("os");
const path = require("path");
const fs = require("node:fs");
const {privateWorkspaceRoot} = require("./workspace");

function serverWorkspace(jarPath, cacheDir) {
  if (/^[\x20-\x7e]+$/.test(cacheDir)) return {directory: cacheDir, jar: path.relative(cacheDir, jarPath), cleanup() {}};
  const root = privateWorkspaceRoot("launch");
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
  const output = dependencies.stdout || process.stdout;
  const parent = dependencies.process || process;
  const spawnChild = dependencies.spawn || spawn;
  const killTimeoutMs = dependencies.killTimeoutMs ?? 2_000;
  const workspace = serverWorkspace(jarPath, cacheDir);
  return new Promise((resolve, reject) => {
    // Java resolves native libraries and the JAR against these paths; both must survive Windows codepages.
    let child;
    try {
      child = spawnChild(dependencies.javaPath || "java", serverArguments(workspace.jar, args), {
        stdio: ["pipe", "pipe", "inherit"], cwd: workspace.directory, windowsHide: true,
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
      child.stdout.unpipe(output);
      input.pause();
      input.removeListener("end", onEnd);
      input.removeListener("close", onEnd);
      input.removeListener("error", onInputError);
      output.removeListener("error", onInputError);
      child.stdout.removeListener("error", onInputError);
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
    child.stdout.on("error", onInputError);
    output.on("error", onInputError);
    input.once("end", onEnd);
    input.once("close", onEnd);
    input.once("error", onInputError);
    parent.on("SIGINT", onInterrupt);
    parent.on("SIGTERM", onTerminate);
    // A fresh pipe keeps Java's descriptor blocking; Node handles a slow MCP reader.
    child.stdout.pipe(output, {end: false});
    if (input.readableEnded || input.destroyed) onEnd();
    else input.pipe(child.stdin);
  });
}

module.exports = { serverArguments, startServer };
