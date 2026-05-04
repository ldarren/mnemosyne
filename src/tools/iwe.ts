import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Type, type Static } from "typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";

function runIwe(
  args: string[],
  iweCwd: string,
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile("iwe", args, { cwd: iweCwd, signal, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === "ABORT_ERR") {
        reject(err);
        return;
      }
      if (err) {
        resolve({ stdout: stdout ?? "", stderr: stderr || err.message });
        return;
      }
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

// ---------- Parameter schemas ----------

const FindParams = Type.Object({
  query: Type.Optional(Type.String({ description: "Fuzzy search query on document title and key" })),
  roots: Type.Optional(Type.Boolean({ description: "Only show root documents (no parents)" })),
  refs_to: Type.Optional(Type.String({ description: "Find documents that reference this key" })),
  refs_from: Type.Optional(Type.String({ description: "Find documents referenced by this key" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 50)" })),
});

const RetrieveParams = Type.Object({
  key: Type.String({ description: "Document key to retrieve" }),
  depth: Type.Optional(Type.Number({ description: "Follow children down N levels (default: 1)" })),
  context: Type.Optional(Type.Number({ description: "Include N levels of parent context (default: 1)" })),
  links: Type.Optional(Type.Boolean({ description: "Include inline referenced documents" })),
  format: Type.Optional(
    Type.Union([Type.Literal("markdown"), Type.Literal("json"), Type.Literal("keys")], {
      description: "Output format (default: markdown)",
    }),
  ),
});

const CreateParams = Type.Object({
  key: Type.String({ description: "Document key including subdirectory path (e.g., 'dvdol/req-sso-integration', 'users/joe-smith')" }),
  content: Type.String({ description: "Full markdown content for the document (including title as # heading)" }),
});

const UpdateParams = Type.Object({
  key: Type.String({ description: "Document key to update" }),
  content: Type.String({ description: "Full replacement markdown content" }),
});

const DeleteParams = Type.Object({
  key: Type.String({ description: "Document key to delete" }),
});

const TreeParams = Type.Object({
  key: Type.Optional(Type.String({ description: "Start tree from this document key" })),
  depth: Type.Optional(Type.Number({ description: "Maximum depth to traverse (default: 4)" })),
});

const StatsParams = Type.Object({});

const ExtractParams = Type.Object({
  key: Type.String({ description: "Source document key" }),
  section: Type.String({ description: "Section title to extract" }),
});

const RenameParams = Type.Object({
  old_key: Type.String({ description: "Current document key" }),
  new_key: Type.String({ description: "New document key" }),
});

// ---------- Tool factories ----------

export function createIweTools(iweCwd: string) {
  return [
    defineTool({
      name: "iwe_find",
      label: "IWE Find",
      description:
        "Search documents in the knowledge graph with fuzzy matching. Without a query, lists all documents sorted by popularity. Returns document keys, titles, parent relationships, and reference counts.",
      promptSnippet: "Search knowledge graph documents",
      parameters: FindParams,
      async execute(_toolCallId, params: Static<typeof FindParams>, signal) {
        const args = ["find"];
        if (params.query) args.push(params.query);
        if (params.roots) args.push("--roots");
        if (params.refs_to) args.push("--refs-to", params.refs_to);
        if (params.refs_from) args.push("--refs-from", params.refs_from);
        if (params.limit) args.push("--limit", String(params.limit));
        args.push("-f", "json");

        const { stdout, stderr } = await runIwe(args, iweCwd, signal);
        if (stderr && !stdout) {
          return { content: [{ type: "text", text: `Error: ${stderr}` }], details: {} };
        }
        return { content: [{ type: "text", text: stdout || "No results found." }], details: {} };
      },
    }),

    defineTool({
      name: "iwe_retrieve",
      label: "IWE Retrieve",
      description:
        "Retrieve a document from the knowledge graph with graph context expansion. Returns the document content along with children (depth) and parent context. Use JSON format for structured output or markdown for readable content.",
      promptSnippet: "Retrieve document with graph context",
      parameters: RetrieveParams,
      async execute(_toolCallId, params: Static<typeof RetrieveParams>, signal) {
        const args = ["retrieve", "-k", params.key];
        if (params.depth !== undefined) args.push("-d", String(params.depth));
        if (params.context !== undefined) args.push("-c", String(params.context));
        if (params.links) args.push("-l");
        if (params.format) args.push("-f", params.format);

        const { stdout, stderr } = await runIwe(args, iweCwd, signal);
        if (stderr && !stdout) {
          return { content: [{ type: "text", text: `Error: ${stderr}` }], details: {} };
        }
        return { content: [{ type: "text", text: stdout || "Document not found." }], details: {} };
      },
    }),

    defineTool({
      name: "iwe_create",
      label: "IWE Create",
      description:
        "Create a new document in the knowledge graph. Provide the full key path (e.g., 'dvdol/req-sso-integration', 'users/joe-smith'). Content should be valid markdown starting with a # title. Use inclusion links [title](key) on their own line to create parent-child hierarchy. Use inline links within text for cross-references.",
      promptSnippet: "Create new knowledge graph document",
      promptGuidelines: [
        "When creating IWE documents, use inclusion links (markdown link on its own line) for hierarchy and inline links within text for cross-references.",
        "Provide the full key path including subdirectory (e.g., 'dvdol/task-setup-ci', 'users/joe-smith').",
      ],
      parameters: CreateParams,
      async execute(_toolCallId, params: Static<typeof CreateParams>, signal) {
        const filePath = join(iweCwd, `${params.key}.md`);
        try {
          if (signal?.aborted) throw new Error("Aborted");
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, params.content, { encoding: "utf-8", flag: "wx" });
          return {
            content: [{ type: "text", text: `Created document: ${params.key}` }],
            details: undefined,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if ((err as NodeJS.ErrnoException).code === "EEXIST") {
            return { content: [{ type: "text", text: `Error: document ${params.key} already exists. Use iwe_update to modify it.` }], details: undefined };
          }
          return { content: [{ type: "text", text: `Error creating ${params.key}: ${msg}` }], details: undefined };
        }
      },
    }),

    defineTool({
      name: "iwe_update",
      label: "IWE Update",
      description:
        "Update the full content of an existing document in the knowledge graph. Replaces the entire document content. First use iwe_retrieve to read the current content, then provide the full updated markdown.",
      promptSnippet: "Update existing knowledge graph document",
      parameters: UpdateParams,
      async execute(_toolCallId, params: Static<typeof UpdateParams>, signal) {
        const filePath = join(iweCwd, `${params.key}.md`);
        try {
          if (signal?.aborted) throw new Error("Aborted");
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, params.content, "utf-8");
          return {
            content: [{ type: "text", text: `Updated document: ${params.key}` }],
            details: undefined,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text", text: `Error updating ${params.key}: ${msg}` }], details: undefined };
        }
      },
    }),

    defineTool({
      name: "iwe_delete",
      label: "IWE Delete",
      description: "Delete a document from the knowledge graph and clean up all references to it.",
      promptSnippet: "Delete knowledge graph document",
      parameters: DeleteParams,
      async execute(_toolCallId, params: Static<typeof DeleteParams>, signal) {
        const { stdout, stderr } = await runIwe(["delete", params.key], iweCwd, signal);
        if (stderr && !stdout) {
          return { content: [{ type: "text", text: `Error: ${stderr}` }], details: {} };
        }
        return { content: [{ type: "text", text: `Deleted document: ${params.key}` }], details: {} };
      },
    }),

    defineTool({
      name: "iwe_tree",
      label: "IWE Tree",
      description:
        "Display the hierarchical structure of the knowledge graph. Shows how documents are organized via inclusion links. Optionally start from a specific document key.",
      promptSnippet: "View knowledge graph hierarchy",
      parameters: TreeParams,
      async execute(_toolCallId, params: Static<typeof TreeParams>, signal) {
        const args = ["tree"];
        if (params.key) args.push("-k", params.key);
        if (params.depth !== undefined) args.push("-d", String(params.depth));
        args.push("-f", "json");

        const { stdout, stderr } = await runIwe(args, iweCwd, signal);
        if (stderr && !stdout) {
          return { content: [{ type: "text", text: `Error: ${stderr}` }], details: {} };
        }
        return { content: [{ type: "text", text: stdout || "Knowledge base is empty." }], details: {} };
      },
    }),

    defineTool({
      name: "iwe_stats",
      label: "IWE Stats",
      description: "Get knowledge graph statistics: document count, link count, broken links, and other metrics.",
      promptSnippet: "Knowledge graph statistics",
      parameters: StatsParams,
      async execute(_toolCallId, _params: Static<typeof StatsParams>, signal) {
        const { stdout, stderr } = await runIwe(["stats"], iweCwd, signal);
        if (stderr && !stdout) {
          return { content: [{ type: "text", text: `Error: ${stderr}` }], details: {} };
        }
        return { content: [{ type: "text", text: stdout || "No statistics available." }], details: {} };
      },
    }),

    defineTool({
      name: "iwe_extract",
      label: "IWE Extract",
      description:
        "Extract a section from an existing document into a new standalone document. The original section is replaced with an inclusion link to the new document. Use this to break large documents into smaller, linked pieces.",
      promptSnippet: "Extract section into new document",
      parameters: ExtractParams,
      async execute(_toolCallId, params: Static<typeof ExtractParams>, signal) {
        const { stdout, stderr } = await runIwe(
          ["extract", params.key, "--section", params.section],
          iweCwd,
          signal,
        );
        if (stderr && !stdout) {
          return { content: [{ type: "text", text: `Error: ${stderr}` }], details: {} };
        }
        return { content: [{ type: "text", text: stdout || "Section extracted." }], details: {} };
      },
    }),

    defineTool({
      name: "iwe_rename",
      label: "IWE Rename",
      description: "Rename a document key with automatic link updates across the entire knowledge graph.",
      promptSnippet: "Rename document with link updates",
      parameters: RenameParams,
      async execute(_toolCallId, params: Static<typeof RenameParams>, signal) {
        const { stdout, stderr } = await runIwe(
          ["rename", params.old_key, params.new_key],
          iweCwd,
          signal,
        );
        if (stderr && !stdout) {
          return { content: [{ type: "text", text: `Error: ${stderr}` }], details: {} };
        }
        return {
          content: [{ type: "text", text: `Renamed: ${params.old_key} → ${params.new_key}` }],
          details: {},
        };
      },
    }),
  ];
}
