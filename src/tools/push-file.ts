import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import { Type, type Static } from "typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";

const PushFileParams = Type.Object({
  file_path: Type.String({ description: "Absolute or relative path to the file to push to the client" }),
  filename: Type.Optional(Type.String({ description: "Display filename for the download (defaults to basename of file_path)" })),
  mime_type: Type.Optional(Type.String({ description: "MIME type of the file (auto-detected if omitted)" })),
});

type PushFileInput = Static<typeof PushFileParams>;

export function createPushFileTool(cwd: string) {
  return defineTool({
    name: "push_file",
    label: "Push File",
    description:
      "Push a file to the client for download. Use this when you need to deliver a generated file to the user's browser or client application. Supports any file type.",
    promptSnippet: "Push a file to the client for download",
    parameters: PushFileParams,
    async execute(_toolCallId, params: PushFileInput, _signal, _onUpdate, ctx) {
      const filePath = resolve(cwd, params.file_path);

      const fileStat = await stat(filePath).catch(() => null);
      if (!fileStat || !fileStat.isFile()) {
        return {
          content: [{ type: "text" as const, text: `Error: file not found at ${filePath}` }],
          details: undefined,
        };
      }

      const basename = filePath.split("/").pop() ?? "file";
      const filename = params.filename ?? basename;
      const mimeType = params.mime_type ?? guessMimeType(basename);

      ctx.ui.setWidget("push_file", [JSON.stringify({ path: filePath, filename, mimeType, size: fileStat.size })]);

      return {
        content: [{ type: "text" as const, text: `File pushed to client: ${filename} (${fileStat.size} bytes)` }],
        details: undefined,
      };
    },
  });
}

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    html: "text/html",
    xml: "application/xml",
    yaml: "text/yaml",
    yml: "text/yaml",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}
