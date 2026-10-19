const {test} = require("node:test");
const assert = require("node:assert/strict");
const {EventEmitter, once} = require("node:events");
const {PassThrough} = require("node:stream");
const {spawn} = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {startServer} = require("../lib/server-process");

function fixture(mode, input = new PassThrough()) {
  const parent = new EventEmitter();
  let child;
  let output = "";
  const ready = [];
  const script = `process.stdout.write('READY\\n');
    if(process.argv[1]==='exit') process.exit(23);
    else if(process.argv[1]==='echo') process.stdin.pipe(process.stdout);
    else {process.stdin.resume();process.stdin.on('end',()=>{});setInterval(()=>{},1000);}`;
  const completion = startServer(path.join(process.cwd(), "server.jar"), process.cwd(), ["--fixture"], {
    stdin: input, process: parent, killTimeoutMs: 100, javaPath: path.resolve("private-runtime/bin/java"),
    spawn(command, args, options) {
      assert.equal(command, path.resolve("private-runtime/bin/java"));
      assert.deepEqual(args, ["-Dfile.encoding=UTF-8", "-jar", "server.jar", "--fixture"]);
      assert.equal(options.cwd, process.cwd());
      assert.equal(options.windowsHide, true);
      child = spawn(process.execPath, ["-e", script, mode], {...options, stdio: ["pipe", "pipe", "pipe"]});
      child.stdout.on("data", chunk => {
        output += chunk;
        if (output.includes("READY\n")) ready.splice(0).forEach(resolve => resolve());
      });
      return child;
    },
  });
  return {input, parent, completion,
    ready: () => output.includes("READY\n") ? Promise.resolve() : new Promise(resolve => ready.push(resolve)),
    output: () => output,
    assertStopped() {
      assert.ok(child.exitCode !== null || child.signalCode !== null);
      assert.throws(() => process.kill(child.pid, 0), {code: "ESRCH"});
      assert.equal(parent.listenerCount("SIGINT"), 0);
      assert.equal(parent.listenerCount("SIGTERM"), 0);
      assert.equal(input.listenerCount("end"), 0);
      assert.equal(input.listenerCount("error"), 0);
      assert.equal(input.listenerCount("close"), 0);
    },
    async cleanup() {
      if (child.exitCode === null && child.signalCode === null) {
        const closed = once(child, "close"); child.kill("SIGKILL"); await closed;
      }
      input.destroy();
    },
  };
}

test("a Korean cache directory is passed as cwd and kept out of the Java JAR argument", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-한글-path-"));
  const input = new PassThrough();
  let invocation;
  try {
    const code = await startServer(path.join(cacheDir, "server.jar"), cacheDir, ["--fixture"], {
      stdin: input, process: new EventEmitter(),
      spawn(command, args, options) {
        invocation = {command, args, cwd: options.cwd};
        return spawn(process.execPath, ["-e", "process.exit(0)"], options);
      },
    });
    assert.equal(code, 0);
    assert.deepEqual(invocation, {command: "java", args: ["-Dfile.encoding=UTF-8", "-jar", "server.jar", "--fixture"], cwd: cacheDir});
  } finally {
    input.destroy();
    assert.equal(path.dirname(path.resolve(cacheDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(cacheDir).startsWith("commerce-한글-path-"));
    fs.rmSync(cacheDir, {recursive: true, force: true});
  }
});

test("STDIO bytes pass unchanged and EOF waits for normal child exit", async () => {
  const f = fixture("echo");
  try {
    await f.ready();
    f.input.end('{"method":"한글 요청"}\n');
    assert.equal(await f.completion, 0);
    assert.equal(f.output(), 'READY\n{"method":"한글 요청"}\n');
    f.assertStopped();
  } finally {await f.cleanup();}
});

test("a nonzero child exit is propagated and releases parent input listeners", async () => {
  const f = fixture("exit");
  try {assert.equal(await f.completion, 23); f.assertStopped();}
  finally {await f.cleanup();}
});

test("EOF stops a child that ignores stdin closure", async () => {
  const f = fixture("hang");
  try {
    await f.ready(); f.input.end();
    assert.equal(await f.completion, 0); f.assertStopped();
  } finally {await f.cleanup();}
});

test("input closure without end also stops the owned child", async () => {
  const f = fixture("hang");
  try {
    await f.ready(); f.input.destroy();
    assert.equal(await f.completion, 0); f.assertStopped();
  } finally {await f.cleanup();}
});

test("input closed before startup does not leave a Java child running", async () => {
  const input = new PassThrough();
  const inputClosed = once(input, "close"); input.destroy(); await inputClosed;
  const f = fixture("hang", input);
  let timeout;
  try {
    const code = await Promise.race([f.completion, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("closed input left the child running")), 2_000);
    })]);
    assert.equal(code, 0); f.assertStopped();
  } finally {clearTimeout(timeout); await f.cleanup();}
});

for (const [signal, expected] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  test(`${signal} forwarding stops the owned child and returns ${expected}`, async () => {
    const f = fixture("hang");
    try {
      await f.ready(); f.parent.emit(signal);
      assert.equal(await f.completion, expected); f.assertStopped();
    } finally {await f.cleanup();}
  });
}

test("input errors stop the child and are reported", async () => {
  const f = fixture("hang");
  try {
    await f.ready();
    const rejected = assert.rejects(f.completion, /fixture input error/);
    f.input.destroy(new Error("fixture input error"));
    await rejected; f.assertStopped();
  } finally {await f.cleanup();}
});

test("spawn failure is reported without leaving signal listeners", async () => {
  const input = new PassThrough(); const parent = new EventEmitter();
  try {
    await assert.rejects(startServer("missing.jar", process.cwd(), [], {stdin: input, process: parent,
      spawn: (_cmd, _args, options) => spawn("commerce-nonexistent-java-fixture", [], options)}), /Unable to start Java MCP server/);
    assert.equal(parent.listenerCount("SIGINT"), 0);
    assert.equal(parent.listenerCount("SIGTERM"), 0);
    assert.equal(input.listenerCount("end"), 0);
  } finally {input.destroy();}
});

for (const [signal, expected] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  test(`real OS ${signal} reaches a Node launcher and stops its child`, {
    skip: process.platform === "win32" ? "Windows kill emulates termination; parent event forwarding is tested separately" : false,
    timeout: 10_000,
  }, async () => {
    const script = `const cp=require('child_process');
      require(process.argv[1]).startServer('fixture.jar',process.cwd(),[],{spawn:(_cmd,_args,options)=>{
        const child=cp.spawn(process.execPath,['-e',"process.stdin.resume();process.stdin.on('end',()=>process.exit(0));process.stdout.write('READY\\\\n');setInterval(()=>{},1000)"],options);
        console.error('OWNED_PID:'+child.pid);return child;
      }}).then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1});`;
    const wrapper = spawn(process.execPath, ["-e", script, require.resolve("../lib/server-process")], {stdio: ["pipe", "pipe", "pipe"], windowsHide: true});
    let stderr = "", output = "";
    const closed = once(wrapper, "close");
    wrapper.stderr.on("data", chunk => stderr += chunk);
    try {
      await new Promise((resolve, reject) => {
        wrapper.once("error", reject);
        wrapper.stdout.on("data", chunk => {output += chunk; if (output.includes("READY")) resolve();});
        wrapper.once("close", () => reject(new Error("Fixture exited before ready: " + stderr)));
      });
      wrapper.kill(signal);
      assert.deepEqual(await closed, [expected, null]);
      const pid = Number(stderr.match(/OWNED_PID:(\d+)/)?.[1]);
      assert.ok(pid); assert.throws(() => process.kill(pid, 0), {code: "ESRCH"});
    } finally {
      wrapper.stdin.destroy();
      if (wrapper.exitCode === null && wrapper.signalCode === null) {wrapper.kill("SIGKILL"); await closed;}
    }
  });
}
