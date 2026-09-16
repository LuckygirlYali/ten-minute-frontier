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

function webSourceCount(response) {
  let count = 0;
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "web_search_call") count += value.action?.sources?.length ?? 0;
    for (const child of Object.values(value)) Array.isArray(child) ? child.forEach(visit) : visit(child);
  };
  visit(response.output);
  return count;
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
      tools: [{ type: "web_search_preview", search_context_size: "low" }],
      tool_choice: "required",
      input: "搜索 OpenAI 官方开发者网站，只返回符合 schema 的结果。",
      max_output_tokens: 1500,
      text: {
        format: {
          type: "json_schema",
          name: "provider_check",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { status: { type: "string", enum: ["ok"] } },
            required: ["status"],
          },
        },
      },
      include: ["web_search_call.action.sources"],
    }),
  }, "Responses API");

  const parsed = JSON.parse(outputText(response));
  const sources = webSourceCount(response);
  if (parsed.status !== "ok" || sources < 1) throw new Error("网页搜索或结构化输出兼容性检查未通过");
  console.log(`第三方兼容性检查通过：模型、Responses、JSON Schema、网页搜索（${sources} 个来源）。`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
