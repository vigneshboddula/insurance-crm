import { PDFParse } from "pdf-parse";

/** Extract plain text from a PDF buffer (digital PDFs). Returns "" on failure
 *  (e.g. a scanned image with no text layer) so the caller can fall back to OCR. */
export async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const res = await parser.getText();
    return (res.text ?? "").trim();
  } catch {
    return "";
  }
}
