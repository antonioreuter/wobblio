import type { ContentBlock } from '@aws-sdk/client-bedrock-runtime';
import type { BedrockMessage } from '@core/ports/ai/IBedrockConverse';

// A PDF rides as a native document block; an image as an image block; otherwise
// text-only. Document/image are mutually exclusive on a message (see the port).
// Shared by BedrockConverseAdapter and CachingBedrockConverseAdapter.
export function toContentBlocks(m: BedrockMessage): ContentBlock[] {
  if (m.document) {
    return [
      { document: { format: m.document.format, name: m.document.name, source: { bytes: m.document.bytes } } },
      { text: m.content },
    ];
  }
  if (m.image) {
    return [{ image: { format: m.image.format, source: { bytes: m.image.bytes } } }, { text: m.content }];
  }
  return [{ text: m.content }];
}

export function extractText(content: Array<{ text?: string }> | undefined): string {
  return content?.find(b => b.text !== undefined)?.text ?? '';
}
