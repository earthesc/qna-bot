const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

/**
 * Ask Claude a question with Notion docs as context
 * Returns { summary, detailed, citedTitles }
 */
async function askClaude(question, docsContent, serverName) {
  const systemPrompt = `You are a Q&A assistant for the "${serverName}" Discord server.
Answer questions using the documentation below.

RULES:
- Just answer the question. Don't add disclaimers like "the docs don't provide a comprehensive guide" or "the docs focus on X rather than Y." If the docs have info that answers the question, just give the answer.
- Don't make up info that isn't in the docs.
- Be concise. Use Discord markdown.

RESPONSE FORMAT:

SUMMARY:
(Answer the question directly. No disclaimers or meta-commentary about what the docs do or don't cover. Just the answer in a few sentences.)

DETAILED:
(Extra details from the docs if useful — steps, lists, specifics. If the summary covers it, write "No additional details." Don't repeat the summary.)

SOURCES:
(Page titles you used, one per line, exactly as in the === Page Title === headers.)

DOCUMENTATION:
${docsContent}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const answer = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

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
