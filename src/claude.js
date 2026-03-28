const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

/**
 * Ask Claude a question with Notion docs as context
 * Returns { summary, detailed, citedTitles }
 */
async function askClaude(question, docsContent, serverName) {
  const systemPrompt = `You are a Q&A assistant for the "${serverName}" Discord server.
Answer questions using ONLY the documentation below.

RULES:
- Answer directly using what the docs say. If the docs have relevant info, use it — don't hedge or say "the docs don't cover this" when they do.
- Do NOT make up information, quotes, examples, or advice that isn't in the docs. Stick to what's written.
- Only say "This isn't covered in the docs" if the docs genuinely have nothing relevant.
- Be concise. Don't pad or repeat yourself.
- Use Discord markdown formatting.

RESPONSE FORMAT:

SUMMARY:
(Direct answer using the docs. A few sentences max. Get to the point.)

DETAILED:
(Only if the docs have more useful details beyond the summary — specific steps, lists, context. Pull directly from the docs. If the summary covers it, write "No additional details." Don't repeat the summary.)

SOURCES:
(Page titles you referenced, one per line, exactly as they appear in the === Page Title === headers.)

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
