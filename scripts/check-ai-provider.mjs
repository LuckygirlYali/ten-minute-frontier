import process from "node:process";

const apiKey = process.env.AI_API_KEY;
const baseUrl = (process.env.AI_API_BASE_URL || "").replace(/\/+$/, "");
const model = process.env.OPENAI_DIGEST_MODEL || "gpt-5.6";

if (!apiKey || !baseUrl) {
  console.error("缺少 AI_API_KEY 或 AI_API_BASE_URL");
  process.exit(1);
}

async function checkedJson(url, options, label) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} 返回 HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

function outputText(response) {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("Responses API 没有返回 output_text");
}

try {
  const headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const models = await checkedJson(`${baseUrl}/models`, { headers }, "Models API");
  const modelIds = (models.data ?? []).map((item) => item.id).filter(Boolean);
  if (!modelIds.includes(model)) {
    throw new Error(`模型 ${model} 不在 Models API 列表中；可用模型示例：${modelIds.slice(0, 20).join(", ")}`);
  }

  const response = await checkedJson(`${baseUrl}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      store: false,
      instructions: "只输出 JSON，不要使用 Markdown。",
      input: "输出 {\"status\":\"ok\"}",
      max_output_tokens: 200,
    }),
  }, "Responses API");

  const parsed = JSON.parse(outputText(response));
  if (parsed.status !== "ok") throw new Error("基础 JSON 输出兼容性检查未通过");
  console.log("第三方兼容性检查通过：认证、模型、Responses API 与基础 JSON 输出可用。");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
