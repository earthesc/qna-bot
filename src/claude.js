const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

async function askClaude(question, docsContent, serverName) {
  const systemPrompt = 'You are a helpful Q&A assistant for the "' + serverName + '" Discord server.\n' +
    'Your job is to answer questions based ONLY on the documentation provided below.\n\n' +
    'RULES:\n' +
    '- Answer based on the documentation content provided. Be accurate and helpful.\n' +
    '- If the answer is not found in the docs, say so clearly - do not make things up.\n' +
    '- Keep answers concise but complete. Use Discord-friendly formatting (markdown).\n' +
    '- If the question is ambiguous, give the most likely interpretation based on the docs.\n\n' +
    'DOCUMENTATION:\n' + docsContent;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const answer = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return answer;
}

module.exports = { askClaude };
