import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { Type, type Static } from "typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";

const ImageParams = Type.Object({
  file_path: Type.String({
    description: "Absolute or relative path to the image file (PNG, JPG, JPEG)",
  }),
});
type ImageInput = Static<typeof ImageParams>;

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function createParseImageTool(cwd: string) {
  return defineTool({
    name: "parse_image",
    label: "Parse Image",
    description:
      "Load an image file (PNG, JPG) and return it for visual analysis. The image content is sent to the model for interpretation. Use this when a user provides a diagram, screenshot, whiteboard photo, or any image that contains project information to ingest into the knowledge base.",
    promptSnippet: "Load and interpret image files",
    parameters: ImageParams,
    async execute(_toolCallId, params: ImageInput) {
      const filePath = resolve(cwd, params.file_path);
      const ext = extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext];

      if (!mimeType) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unsupported image format: ${ext}. Supported: .png, .jpg, .jpeg`,
            },
          ],
          details: undefined,
        };
      }

      const buffer = await readFile(filePath);
      const data = buffer.toString("base64");

      return {
        content: [
          { type: "image" as const, data, mimeType },
          {
            type: "text" as const,
            text: `Image loaded: ${filePath} (${mimeType}, ${Math.round(buffer.length / 1024)}KB). Describe and extract any project-relevant information from this image.`,
          },
        ],
        details: undefined,
      };
    },
  });
}
