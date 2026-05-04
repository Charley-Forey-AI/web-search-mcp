export type TextChunk = {
  id: string;
  text: string;
  quote: string;
};

export function chunkText(url: string, text: string, chunkSize = 1800): TextChunk[] {
  const chunks: TextChunk[] = [];
  let idx = 0;
  for (let start = 0; start < text.length; start += chunkSize) {
    const piece = text.slice(start, start + chunkSize).trim();
    if (!piece) continue;
    chunks.push({
      id: `${url}#chunk=${idx++}`,
      text: piece,
      quote: piece.slice(0, 200),
    });
  }
  return chunks;
}
