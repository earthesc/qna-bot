const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

/**
 * Ask Claude a question with Notion docs as context
 * Returns { summary, detailed, citedTitles }
 */
async function askClaude(question, docsContent, serverName) {
  const systemPrompt = `You are a Q&A assistant for the "${serverName}" Discord server.
Your job is to answer questions using ONLY the documentation provided below.

STRICT RULES:
- ONLY use information that is explicitly stated in the documentation. Do NOT infer, extrapolate, paraphrase loosely, or generate advice/quotes/examples that aren't directly in the docs.
- If the docs don't contain the answer, say "This isn't covered in the docs." Do NOT guess or fill in gaps.
- Keep responses concise. Quality over quantity. Don't pad answers with filler.
- Use Discord-friendly markdown formatting.

RESPONSE FORMAT:
You MUST structure your response exactly like this:

SUMMARY:
(A concise, direct answer to the question using only what the docs say. Keep it short — a few sentences max.)

DETAILED:
(Only include this if the docs contain additional relevant details beyond the summary. Pull directly from the docs — specific steps, lists, or info that adds real value. If the summary already covers everything, just write "No additional details." Do NOT repeat the summary or pad with generic advice.)

SOURCES:
(List ONLY the page titles you actually referenced. Write each title on its own line, exactly as it appears in the === Page Title === headers.)

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
