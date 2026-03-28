const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

/**
 * Ask Claude a question with Notion docs as context
 * Returns { summary, detailed, citedTitles }
 */
async function askClaude(question, docsContent, serverName) {
  const systemPrompt = `You are a helpful Q&A assistant for the "${serverName}" Discord server.
Your job is to answer questions based ONLY on the documentation provided below.

RULES:
- Answer based on the documentation content provided. Be accurate and helpful.
- If the answer is not found in the docs, say so clearly — don't make things up.
- Use Discord-friendly formatting (markdown).
- If the question is ambiguous, give the most likely interpretation based on the docs.

RESPONSE FORMAT:
You MUST structure your response exactly like this:

SUMMARY:
(Write a single concise paragraph that directly answers the question. Keep it under 200 words.)

DETAILED:
(Write a thorough, complete answer with all relevant details, examples, and context from the docs. Use markdown formatting, bullet points, headers etc. as needed.)

SOURCES:
(List ONLY the page titles from the documentation below that you actually used to answer the question. Write each title on its own line, exactly as it appears in the === Page Title === headers. Only include pages whose content you referenced in your answer.)

DOCUMENTATION:
${docsContent}`;

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

  // Parse out summary, detailed, and sources sections
  const summaryMatch = answer.match(/SUMMARY:\s*\n([\s\S]*?)(?=\nDETAILED:)/i);
  const detailedMatch = answer.match(/DETAILED:\s*\n([\s\S]*?)(?=\nSOURCES:|$)/i);
  const sourcesMatch = answer.match(/SOURCES:\s*\n([\s\S]*)/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : answer.slice(0, 500);
  const detailed = detailedMatch ? detailedMatch[1].trim() : answer;
  const citedTitles = sourcesMatch
    ? sourcesMatch[1].trim().split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean)
    : [];

  return { summary, detailed, citedTitles };
}

module.exports = { askClaude };
