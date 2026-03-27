const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const MAX_DEPTH = 5;

function extractText(richTextArray) {
  if (!richTextArray) return "";
  return richTextArray.map((t) => t.plain_text).join("");
}

function blockToText(block) {
  const type = block.type;
  const data = block[type];
  if (!data) return "";

  if (data.rich_text) {
    const text = extractText(data.rich_text);
    switch (type) {
      case "heading_1": return "# " + text;
      case "heading_2": return "## " + text;
      case "heading_3": return "### " + text;
      case "bulleted_list_item": return "- " + text;
      case "numbered_list_item": return "- " + text;
      case "to_do": return (data.checked ? "[x] " : "[ ] ") + text;
      case "toggle": return "> " + text;
      case "quote": return "> " + text;
      case "callout": return "> " + text;
      default: return text;
    }
  }

  if (type === "code") {
    return bt+bt+bt + (data.language || "") + "\n" + extractText(data.rich_text) + "\n" + bt+bt+bt;
  }
  if (type === "divider") return "---";
  if (type === "child_page") return "## " + (data.title || "Untitled");
  if (type === "child_database") return "## [Database] " + (data.title || "Untitled");
  return "";
}

async function fetchBlockChildren(blockId, depth) {
  if (depth > MAX_DEPTH) return [];
  const blocks = [];
  let cursor;
  try {
    do {
      const response = await notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      });
      for (const block of response.results) {
        const text = blockToText(block);
        const indent = "  ".repeat(depth);
        if (text) blocks.push(indent + text);
        if (block.has_children) {
          const children = await fetchBlockChildren(block.id, depth + 1);
          blocks.push(...children);
        }
      }
      cursor = response.has_more ? response.next_cursor : null;
    } while (cursor);
  } catch (err) {
    // Skip blocks we cannot access
  }
  return blocks;
}

async function fetchPageContent(pageId) {
  const blocks = await fetchBlockChildren(pageId, 0);
  return blocks.join("\n");
}

async function getPageTitle(pageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const titleProp = Object.values(page.properties).find((p) => p.type === "title");
    if (titleProp && titleProp.title) return extractText(titleProp.title);
    return "Untitled";
  } catch { return "Untitled"; }
}

async function fetchDatabasePages(databaseId) {
  const pages = [];
  let cursor;
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 50,
    });
    for (const page of response.results) {
      const title = await getPageTitle(page.id);
      const content = await fetchPageContent(page.id);
      if (content.trim()) pages.push({ title, content });
    }
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return pages;
}

async function fetchAllContent(notionIds) {
  const sections = [];
  for (const id of notionIds) {
    try {
      try {
        const dbPages = await fetchDatabasePages(id);
        for (const page of dbPages) {
          sections.push("=== " + page.title + " ===\n" + page.content);
        }
        continue;
      } catch { }
      const title = await getPageTitle(id);
      const content = await fetchPageContent(id);
      if (content.trim()) sections.push("=== " + title + " ===\n" + content);
    } catch (err) {
      console.error("Failed to fetch Notion content for ID " + id + ":", err.message);
    }
  }
  return sections.join("\n\n");
}

module.exports = { fetchAllContent, fetchPageContent, fetchDatabasePages };
