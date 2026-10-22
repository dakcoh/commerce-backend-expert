const {temporaryDirectory} = require("./support/fixtures");
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {EventEmitter} = require("node:events");
const {PassThrough} = require("node:stream");
const fs = require("node:fs");
const path = require("node:path");
const {fetchText, download} = require("../lib/release-client");
const URL = "https://github.com/fixture";

// Real streams/files with a fake HTTPS transport; never contact a release host.
function transport(steps) {
  const calls = [];
  return {calls, httpsGet(url, _options, callback) {
    const req = new EventEmitter();
    req.setTimeout = (_ms, onIdle) => {req.onIdle = onIdle;};
    let destroyed = false;
    req.destroy = (error) => {
      if (!destroyed) {destroyed = true; queueMicrotask(() => req.emit("error", error));}
    };
    calls.push(url);
    setImmediate(() => {
      if (destroyed) return;
      const step = steps[Math.min(calls.length - 1, steps.length - 1)];
      step.beforeResponse?.();
      const response = new PassThrough();
      response.statusCode = step.status || 200;
      response.headers = step.headers || {};
      callback(response);
      if (step.body) response.end(step.body);
      else if (step.run) step.run(response, req);
      else if (!step.hang) response.end();
    });
    return req;
  }};
}

function tempFile(t) {
  const {dir, cleanup} = temporaryDirectory("commerce-transfer-", t);
  return {file: path.join(dir, "asset.tmp"), cleanup};
}

test("HTTPS allowlist is checked before every redirect and limits redirect loops", async () => {
  for (const location of ["http://github.com/plain", "https://example.com/asset"]) {
    const t = transport([{status: 302, headers: {location}}]);
    await assert.rejects(fetchText(URL, t), /untrusted/);
    assert.equal(t.calls.length, 1);
  }
  const loop = transport([{status: 302, headers: {location: "/loop"}}]);
  await assert.rejects(fetchText(URL, loop), /Too many redirects/);
  assert.equal(loop.calls.length, 6);
  const good = transport([{status: 302, headers: {location: "https://release-assets.githubusercontent.com/asset"}}, {body: "checksum"}]);
  assert.equal(await fetchText(URL, good), "checksum");
});

test("checksum HTTP errors, premature close and oversized bodies fail closed", async () => {
  await assert.rejects(fetchText(URL, transport([{status: 404}])), /HTTP 404/);
  await assert.rejects(fetchText(URL, transport([{body: Buffer.alloc(65_537)}])), /exceeds/);
  await assert.rejects(fetchText(URL, transport([{run: r => {r.write("partial"); r.destroy();}}])), /close|abort/i);
});

test("a deadline covers the body and redirects even when data keeps arriving", async context => {
  context.mock.timers.enable({apis: ["Date", "setTimeout", "setInterval"]});
  const controller = new AbortController();
  context.after(() => controller.abort());
  let bodyReady;
  const ready = new Promise(resolve => {bodyReady = resolve;});
  const t = transport([{status: 302, headers: {location: "/asset"},
    beforeResponse: () => context.mock.timers.tick(25)}, {run: r => {
    const timer = setInterval(() => r.write("x"), 3);
    r.once("close", () => clearInterval(timer));
    bodyReady();
  }}]);
  let outcome;
  const transfer = fetchText(URL, {...t, totalTimeoutMs: 40, signal: controller.signal})
    .then(value => {outcome = {value};}, error => {outcome = {error};});
  await ready;
  assert.equal(t.calls.length, 2);
  context.mock.timers.tick(14);
  await new Promise(setImmediate);
  assert.equal(outcome, undefined, "Transfer must remain active before the original deadline");
  context.mock.timers.tick(1);
  await new Promise(setImmediate);
  assert.match(outcome?.error?.message || "", /timed out/, "Redirects must not reset the deadline");
  await transfer;
});

test("idle timeout and caller abort terminate an unfinished body", async () => {
  await assert.rejects(fetchText(URL, transport([{run: (_r, req) => req.onIdle()}])), /timed out/);
  const controller = new AbortController();
  const result = fetchText(URL, {...transport([{run: () => controller.abort(new Error("fixture abort"))}]), signal: controller.signal});
  await assert.rejects(result, /fixture abort/);
  await assert.rejects(fetchText(URL, {...transport([{body: "unused"}]), signal: controller.signal}), /fixture abort/);
});

test("failed transfers remove partial files and can be retried", async t => {
  const f = tempFile(t);
  try {
    const steps = [
      {headers: {"content-length": "20"}, body: "short"},
      {run: r => {r.write("partial"); setImmediate(() => r.destroy(new Error("connection reset")));}},
      {headers: {"content-length": "bad"}, body: "invalid"},
      {hang: true},
    ];
    for (const step of steps) {
      await assert.rejects(download(URL, f.file, () => {}, {...transport([step]), totalTimeoutMs: 40}));
      assert.equal(fs.existsSync(f.file), false);
    }
    await assert.rejects(download(URL, f.file, () => {throw new Error("progress failed");}, transport([{body: "data"}])) , /progress failed/);
    assert.equal(fs.existsSync(f.file), false);
    assert.deepEqual(await download(URL, f.file, () => {}, transport([{headers: {"content-length": "4"}, body: "data"}])), {received: 4, expected: 4});
    assert.equal(fs.readFileSync(f.file, "utf8"), "data");
  } finally {f.cleanup();}
});

test("an existing destination survives a write error", async t => {
  const f = tempFile(t);
  try {
    fs.writeFileSync(f.file, "existing");
    await assert.rejects(download(URL, f.file, () => {}, transport([{body: "replacement"}])), {code: "EEXIST"});
    assert.equal(fs.readFileSync(f.file, "utf8"), "existing");
  } finally {f.cleanup();}
});
