import { Request, Response } from 'express';

const EMBEDDING_DIMS = 512;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicVector(seed: number): number[] {
  const vector: number[] = [];
  let state = seed;
  for (let i = 0; i < EMBEDDING_DIMS; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    vector.push((state / 0xffffffff) * 2 - 1);
  }
  return vector;
}

function extractInputText(body: unknown): string {
  try {
    const b = body as { inputText?: string };
    return b?.inputText ?? '';
  } catch {
    return '';
  }
}

export function embedderHandler(req: Request, res: Response): void {
  const inputText = extractInputText(req.body);
  const seed = hashString(inputText);
  const embedding = deterministicVector(seed);

  res.json({
    embedding,
    inputTextTokenCount: Math.ceil(inputText.length / 4),
  });
}
