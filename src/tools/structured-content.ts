import { Type, type Static } from "typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";

const StructuredContentParams = Type.Object({
  content_type: Type.Union([Type.Literal("json"), Type.Literal("base64")], {
    description: "Type of structured content: 'json' for JSON data, 'base64' for binary content",
  }),
  data: Type.String({ description: "The content data (JSON string or base64-encoded binary)" }),
  title: Type.Optional(Type.String({ description: "Optional title/label for the content" })),
  mime_type: Type.Optional(Type.String({ description: "MIME type for base64 content (e.g. 'image/png')" })),
});

type StructuredContentInput = Static<typeof StructuredContentParams>;

export function createStructuredContentTool() {
  return defineTool({
    name: "structured_content",
    label: "Structured Content",
    description:
      "Send structured content (JSON or base64 binary) to the client for special rendering. Use this when the output requires rich display rather than plain text — e.g. JSON data that should be pretty-printed, or binary content that needs to be rendered as an image/file.",
    promptSnippet: "Send structured content for rich display",
    parameters: StructuredContentParams,
    async execute(_toolCallId, params: StructuredContentInput, _signal, _onUpdate, ctx) {
      const payload: Record<string, unknown> = {
        contentType: params.content_type,
        data: params.data,
      };
      if (params.title) payload.title = params.title;
      if (params.mime_type) payload.mimeType = params.mime_type;

      ctx.ui.setWidget("structured_content", [JSON.stringify(payload)]);

      const preview = params.content_type === "json"
        ? `JSON content${params.title ? ` (${params.title})` : ""}`
        : `Binary content (${params.mime_type ?? "application/octet-stream"})${params.title ? ` — ${params.title}` : ""}`;

      return {
        content: [{ type: "text" as const, text: `Structured content sent to client: ${preview}` }],
        details: undefined,
      };
    },
  });
}
