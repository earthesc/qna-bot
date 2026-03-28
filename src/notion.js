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
      case "heading_1":
        return "# " + text;
      case "heading_2":
        return "## " + text;
      case "heading_3":
        return "### " + text;
      case "bulleted_list_item":
        return "- " + text;
      case "numbered_list_item":
        return "- " + text;
      case "to_do":
        return (data.checked ? "[x] " : "[ ] ") + text;
      case "toggle":
        return "> " + text;
      case "quote":
        return "> " + text;
      case "callout":
        return "> " + text;
      default:
        return text;
    }
  }

  if (type === "code") {
    const code = extractText(data.rich_text);
    return "```" + (data.language || "") + "\n" + code + "\n```";
  }

  if (type === "divider") return "---";
  if (type === "table") return "[Table]";

  return "";
}

/**
 * Fetch blocks from a page/block, but DON'T recurse into child_page blocks.
 * Instead, collect child page IDs so they can be fetched as separate sources.
 */
async function fetchBlocksFlat(blockId, depth, childPageIds) {
  if (depth > MAX_DEPTH) return [];
  const lines = [];
  let cursor;

  try {
    do {
      const response = await notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        // If it's a child_page, don't inline it — track it for separate fetching
        if (block.type === "child_page") {
          childPageIds.push(block.id);
          continue;
        }
        // If it's a child_database, track it too
        if (block.type === "child_database") {
          childPageIds.push(block.id);
          continue;
        }

        const text = blockToText(block);
        const indent = "  ".repeat(depth);
        if (text) lines.push(indent + text);

        if (block.has_children) {
          const children = await fetchBlocksFlat(block.id, depth + 1, childPageIds);
          lines.push(...children);
        }
      }

      cursor = response.has_more ? response.next_cursor : null;
    } while (cursor);
  } catch (err) {
    // Skip inaccessible blocks
  }

  return lines;
}

async function getPageTitle(pageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const titleProp = Object.values(page.properties).find(
      (p) => p.type === "title"
    );
    if (titleProp && titleProp.title) {
      return extractText(titleProp.title);
    }
    return "Untitled";
  } catch {
    return "Untitled";
  }
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
      pages.push(page.id);
    }

    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return pages;
}

/**
 * Recursively fetch a page and all its child pages as separate sources.
 * Each child page becomes its own { title, id, content } entry.
 */
async function fetchPageAsSource(pageId, sections, sources, visited) {
  if (visited.has(pageId)) return;
  visited.add(pageId);

  const title = await getPageTitle(pageId);
  const childPageIds = [];
  const lines = await fetchBlocksFlat(pageId, 0, childPageIds);
  const content = lines.join("\n");

  if (content.trim()) {
    sections.push("=== " + title + " ===\n" + content);
    sources.push({ title, id: pageId });
  }

  // Recursively fetch each child page as its own source
  for (const childId of childPageIds) {
    try {
      // Check if it's a database
      try {
        const dbPageIds = await fetchDatabasePages(childId);
        for (const dbPageId of dbPageIds) {
          await fetchPageAsSource(dbPageId, sections, sources, visited);
        }
        continue;
      } catch { }

      // Otherwise it's a child page
      await fetchPageAsSource(childId, sections, sources, visited);
    } catch (err) {
      // Skip inaccessible children
    }
  }
}

async function fetchAllContent(notionIds) {
  const sections = [];
  const sources = [];
  const visited = new Set();

  for (const id of notionIds) {
    try {
      // Try as database first
      try {
        const dbPageIds = await fetchDatabasePages(id);
        for (const pageId of dbPageIds) {
          await fetchPageAsSource(pageId, sections, sources, visited);
        }
        continue;
      } catch { }

      // Otherwise treat as a page — recursively fetch it and all child pages
      await fetchPageAsSource(id, sections, sources, visited);
    } catch (err) {
      console.error("Failed to fetch Notion content for ID " + id + ":", err.message);
    }
  }

  return { text: sections.join("\n\n"), sources };
}

module.exports = { fetchAllContent };
