// Development-only, client-neutral evaluation. No LLM calls or credentials are used here.
const fs = require("fs");
const fixtures = require("./fixtures/ai-workflows.json");

function resultData(result) {
  if (result?.isError) return null;
  if (result?.structuredContent) return result.structuredContent;
  if (result?.content) {
    const text = result.content.find((item) => item.type === "text")?.text;
    try { return JSON.parse(text); } catch { return null; }
  }
  return result;
}

function grade(row) {
  const task = fixtures.find((item) => item.id === row.taskId);
  if (!task) throw new Error(`Unknown taskId: ${row.taskId}`);
  if (!row.model || !row.client || !Number.isInteger(row.run) || !row.finalAnswer?.trim()
      || !Array.isArray(row.toolCalls)) throw new Error("Record model, client, run, finalAnswer and toolCalls");
  const ids = new Set();
  for (const call of row.toolCalls) {
    const data = resultData(call.result);
    if (!data) continue;
    if (data.rule?.id) ids.add(data.rule.id);
    for (const item of [...(data.results || []), ...(data.findings || []), ...(data.rules || []), ...(data.fullRules || [])]) {
      if (item.ruleId || item.id) ids.add(item.ruleId || item.id);
    }
  }
  const rulePassed = !task.anyRuleIds.length || task.anyRuleIds.some((id) => ids.has(id));
  const pending = task.humanChecks.filter((key) => typeof row.humanChecks?.[key] !== "boolean");
  if (!row.reviewedBy?.trim() || !Number.isFinite(Date.parse(row.reviewedAt))) pending.push("reviewer/date");
  const failed = task.humanChecks.filter((key) => row.humanChecks?.[key] === false);
  const metric = (key) => Number.isFinite(row[key]) && row[key] >= 0 ? row[key] : null;
  return {taskId: row.taskId, model: row.model, client: row.client, run: row.run,
    status: !rulePassed || failed.length ? "failed" : pending.length ? "pending" : "passed",
    rulePassed, pendingHumanChecks: pending, failedHumanChecks: failed, toolCalls: row.toolCalls.length,
    inputTokens: metric("inputTokens"), outputTokens: metric("outputTokens"), elapsedMs: metric("elapsedMs")};
}

if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error("Usage: node test/grade-ai-transcripts.js <reviewed-transcripts.jsonl>");
    const rows = fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse);
    if (!rows.length) throw new Error("No transcripts supplied");
    const identities = rows.map((row) => JSON.stringify([row.taskId, row.client, row.model, row.run]));
    if (new Set(identities).size !== identities.length) throw new Error("Duplicate task/client/model/run");
    const results = rows.map(grade);
    const groups = [...new Set(results.map((row) => JSON.stringify([row.client, row.model])))];
    const missingTasks = groups.flatMap((group) => {
      const [client, model] = JSON.parse(group);
      return fixtures.filter((task) => !results.some((row) => row.client === client && row.model === model && row.taskId === task.id))
        .map((task) => ({client, model, taskId: task.id}));
    });
    const report = {executedTranscripts: results.length, missingTasks, results};
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = results.some((row) => row.status === "failed") ? 1
      : missingTasks.length || results.some((row) => row.status === "pending") ? 2 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {grade};
