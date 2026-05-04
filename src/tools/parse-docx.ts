import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Type, type Static } from "typebox";
import mammoth from "mammoth";
import { defineTool } from "@mariozechner/pi-coding-agent";

const DocxParams = Type.Object({
  file_path: Type.String({ description: "Absolute or relative path to the DOCX file" }),
});

type DocxInput = Static<typeof DocxParams>;

export function createParseDocxTool(cwd: string) {
  return defineTool({
    name: "parse_docx",
    label: "Parse DOCX",
    description:
      "Extract text content from a DOCX (Word) file. Preserves paragraph structure and headings. Use this when a user provides a DOCX file that needs to be ingested into the knowledge base.",
    promptSnippet: "Extract text from DOCX files",
    parameters: DocxParams,
    async execute(_toolCallId, params: DocxInput) {
      const filePath = resolve(cwd, params.file_path);
      const buffer = await readFile(filePath);

      const htmlResult = await mammoth.convertToHtml({ buffer });
      const rawResult = await mammoth.extractRawText({ buffer });

      const warnings = htmlResult.messages
        .filter((m): m is { type: "warning"; message: string } => m.type === "warning")
        .map((m) => m.message);

      const text = rawResult.value.trim();
      if (!text) {
        return {
          content: [{ type: "text", text: "DOCX contained no extractable text." }],
          details: { chars: 0, warnings },
        };
      }

      let output = text;
      if (warnings.length > 0) {
        output = `Warnings: ${warnings.join("; ")}\n\n${text}`;
      }

      return {
        content: [{ type: "text", text: output }],
        details: { chars: text.length, warnings },
      };
    },
  });
}
