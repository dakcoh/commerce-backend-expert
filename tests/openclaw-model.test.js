const test = require("node:test");
const assert = require("node:assert/strict");
const {localEndpoint, assessReadProbe, isolatedSkillEntries} = require("../scripts/probe-openclaw-model");

test("native model probe rejects nonlocal, credential and compatibility endpoints", () => {
  assert.equal(localEndpoint("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
  assert.equal(localEndpoint("http://[::1]:11434/"), "http://[::1]:11434");
  for (const url of ["https://example.com", "http://192.168.0.1:11434", "http://localhost:11434/v1", "http://key@localhost:11434", "http://localhost:11434/?key=x"]) assert.throws(() => localEndpoint(url));
});

test("native ok and tool-call JSON cannot pass a file-read probe", () => {
  const valid = {ok: true, toolSummary: {calls: 1, failures: 0, tools: ["read"]}, final: "hidden-marker"};
  assert.deepEqual(assessReadProbe(valid, "hidden-marker"), {nativeOk: true, readReportedWithoutError: true, exactOutput: true});
  const fake = {ok: true, final: '[{"function":{"name":"read","arguments":{"path":"marker.txt"}}}]'};
  assert.deepEqual(assessReadProbe(fake, "hidden-marker"), {nativeOk: true, readReportedWithoutError: false, exactOutput: false});
  assert.equal(assessReadProbe({...valid, toolSummary: {...valid.toolSummary, failures: 1}}, "hidden-marker").readReportedWithoutError, false);
  assert.equal(assessReadProbe({...valid, toolSummary: {...valid.toolSummary, calls: 2}}, "hidden-marker").readReportedWithoutError, true);
  const optionalMissing = assessReadProbe({...valid, final: "Optional file not found: marker.txt."}, "hidden-marker");
  assert.equal(optionalMissing.readReportedWithoutError, true);
  assert.equal(Object.values(optionalMissing).every(Boolean), false);
});

test("native probe disables discovered custodian skills as well as bundled skills", () => {
  assert.deepEqual(isolatedSkillEntries([{name: "github"}, {name: "commerce-review"}, {name: "weather"}], ["commerce-review"]), {
    github: {enabled: false}, "commerce-review": {enabled: true}, weather: {enabled: false},
  });
  assert.throws(() => isolatedSkillEntries([{name: "github"}], ["missing"]), /not discovered/);
});

test("native CSS probe requires exact retained text and rejects extra skill reads", () => {
  const native = {ok: true, toolSummary: {calls: 1, failures: 0, tools: ["read"]}, final: "```html\n<button>probe</button>\n```"};
  assert.equal(assessReadProbe(native, "<button>probe</button>\n", true).exactOutput, true);
  assert.equal(assessReadProbe(native, "<button>other</button>\n", true).exactOutput, false);
  assert.equal(assessReadProbe({...native, final: "```html\n<button> probe </button>\n```"}, "<button>probe</button>", true).exactOutput, false);
  assert.equal(assessReadProbe({...native, toolSummary: {calls: 2, failures: 0, tools: ["read", "skills_read"]}}, "<button>probe</button>", true).readReportedWithoutError, false);
});
