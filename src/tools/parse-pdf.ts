import { resolve } from "node:path";
import { Type, type Static } from "typebox";
import { PDFParse } from "pdf-parse";
import { defineTool } from "@mariozechner/pi-coding-agent";

const PdfParams = Type.Object({
  file_path: Type.String({ description: "Absolute or relative path to the PDF file" }),
});

type PdfInput = Static<typeof PdfParams>;

export function createParsePdfTool(cwd: string) {
  return defineTool({
    name: "parse_pdf",
    label: "Parse PDF",
    description:
      "Extract text content from a PDF file. Returns the full text of the document. Use this when a user provides a PDF file that needs to be ingested into the knowledge base.",
    promptSnippet: "Extract text from PDF files",
    parameters: PdfParams,
    async execute(_toolCallId, params: PdfInput) {
      const filePath = resolve(cwd, params.file_path);
      const parser = new PDFParse({url: filePath});
      const infoRes = await parser.getInfo({ parsePageInfo: true });

      const info = [
        `Pages: ${infoRes.total}`,
        infoRes.info?.Title ? `Title: ${infoRes.info.Title}` : null,
        infoRes.info?.Author ? `Author: ${infoRes.info.Author}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const textRes = await parser.getText({ parsePageInfo: true });
      const text = textRes.text.trim();
      if (!text) {
        return {
          content: [{ type: "text", text: "PDF contained no extractable text (may be image-based)." }],
          details: { pages: infoRes.total, chars: 0 },
        };
      }

      return {
        content: [{ type: "text", text: `${info}\n\n${text}` }],
        details: { pages: infoRes.total, chars: text.length },
      };
    },
  });
}
