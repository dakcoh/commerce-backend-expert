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
  const reviewType = row.reviewType ?? "human";
  if (!["human", "agent"].includes(reviewType)) throw new Error("reviewType must be human or agent");
  const checks = reviewType === "agent" ? row.agentChecks : row.humanChecks;
  const pending = task.humanChecks.filter((key) => reviewType === "agent"
    ? typeof checks?.[key]?.passed !== "boolean" || !checks[key].quote?.trim()
      || !row.finalAnswer.includes(checks[key].quote) || !checks[key].rationale?.trim()
    : typeof checks?.[key] !== "boolean");
  if (!row.reviewedBy?.trim() || !Number.isFinite(Date.parse(row.reviewedAt))) pending.push("reviewer/date");
  const failed = task.humanChecks.filter((key) => (reviewType === "agent" ? checks?.[key]?.passed : checks?.[key]) === false);
  const executionPassed = (row.executionCode === undefined || row.executionCode === 0)
    && (row.turnCompleted === undefined || row.turnCompleted === true);
  const toolFailed = (call) => call.status === "failed" || Boolean(call.error || call.result?.isError);
  const lastError = row.toolCalls.findLastIndex(toolFailed);
  const errorRecovered = task.id === "AI-12" ? lastError >= 0
    && row.toolCalls.slice(lastError + 1).some(call => call.result && !toolFailed(call)) : null;
  const metric = (key) => Number.isFinite(row[key]) && row[key] >= 0 ? row[key] : null;
  return {taskId: row.taskId, model: row.model, client: row.client, run: row.run,
    status: !executionPassed || !rulePassed || errorRecovered === false || failed.length ? "failed" : pending.length ? "pending" : "passed",
    reviewType, executionPassed, rulePassed, errorRecovered, toolErrorCount: row.toolCalls.filter(toolFailed).length,
    pendingHumanChecks: reviewType === "human" ? pending : [], failedHumanChecks: reviewType === "human" ? failed : [],
    pendingAgentChecks: reviewType === "agent" ? pending : [], failedAgentChecks: reviewType === "agent" ? failed : [],
    toolCalls: row.toolCalls.length,
    inputTokens: metric("inputTokens"), outputTokens: metric("outputTokens"), elapsedMs: metric("elapsedMs")};
}

function evaluate(rows) {
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
  const exitCode = results.some((row) => row.status === "failed") ? 1
    : missingTasks.length || results.some((row) => row.status === "pending") ? 2 : 0;
  return {report, exitCode};
}

if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error("Usage: node test/grade-ai-transcripts.js <reviewed-transcripts.jsonl>");
    const rows = fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse);
    const {report, exitCode} = evaluate(rows);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = exitCode;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {grade, evaluate};
