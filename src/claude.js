const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

async function askClaude(question, docsContent, serverName) {
  const systemPrompt = 'You are a helpful Q&A assistant for the "' + serverName + '" Discord server.\n' +
    'Your job is to answer questions based ONLY on the documentation provided below.\n\n' +
    'RULES:\n' +
    '- Answer based on the documentation content provided. Be accurate and helpful.\n' +
    '- If the answer is not found in the docs, say so clearly - do not make things up.\n' +
    '- Use Discord-friendly formatting (markdown).\n' +
    '- If the question is ambiguous, give the most likely interpretation based on the docs.\n\n' +
    'RESPONSE FORMAT:\n' +
    'You MUST structure your response exactly like this:\n\n' +
    'SUMMARY:\n' +
    '(Write a single concise paragraph that directly answers the question. Keep it under 200 words.)\n\n' +
    'DETAILED:\n' +
    '(Write a thorough, complete answer with all relevant details, examples, and context from the docs. Use markdown formatting, bullet points, headers etc. as needed.)\n\n' +
    'DOCUMENTATION:\n' + docsContent;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const answer = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const summaryMatch = answer.match(/SUMMARY:\s*\n([\s\S]*?)(?=\nDETAILED:)/i);
  const detailedMatch = answer.match(/DETAILED:\s*\n([\s\S]*)/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : answer.slice(0, 500);
  const detailed = detailedMatch ? detailedMatch[1].trim() : answer;

  return { summary, detailed };
}

module.exports = { askClaude };
