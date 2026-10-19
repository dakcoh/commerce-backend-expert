const { spawn } = require("child_process");
const { constants } = require("os");
const path = require("path");

function serverArguments(jarPath, args = []) {
  return [
    "-Dfile.encoding=UTF-8",
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
  return new Promise((resolve, reject) => {
    // Keep the Unicode cache directory in cwd; Windows Java launchers can corrupt non-ASCII arguments.
    const child = spawnChild(dependencies.javaPath || "java", serverArguments(path.relative(cacheDir, jarPath), args), {
      stdio: ["pipe", "inherit", "inherit"], cwd: cacheDir, windowsHide: true,
    });
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
