import { Request, Response } from 'express';

const MERCHANT_RESPONSE = {
  decision: 'AH001',
  brand_name: null,
  confidence: 0.97,
};

const PRODUCT_EXPANSION_RESPONSE = {
  lines: [
    {
      index: 0,
      brand: 'Albert Heijn',
      product_name: 'Biologische Halfvolle Melk',
      variant: null,
      pack_quantity: 1,
      pack_unit: 'L',
      category_id: 'cat-dairy',
      is_deposit_or_fee: false,
    },
  ],
  suggested_tags: ['weekly-groceries'],
};

const CLASSIFICATION_RESPONSE = {
  category_id: 'cat-groceries',
  confidence: 0.92,
};

const INSIGHT_RESPONSE =
  'Je hebt deze week meer uitgegeven aan boodschappen dan vorige week. Overweeg bulk-aankopen bij Lidl voor extra besparing.';

function detectCallType(body: unknown): 'merchant' | 'product' | 'classification' | 'insight' {
  const text = extractPromptText(body);
  if (text.includes('merchant') || text.includes('alias')) return 'merchant';
  if (text.includes('product') || text.includes('line_item')) return 'product';
  if (text.includes('classif') || text.includes('categor')) return 'classification';
  return 'insight';
}

function extractPromptText(body: unknown): string {
  try {
    const b = body as { messages?: Array<{ content?: Array<{ text?: string }> }> };
    return b?.messages?.[0]?.content?.[0]?.text ?? '';
  } catch {
    return '';
  }
}

export function auxiliaryHandler(req: Request, res: Response): void {
  const callType = detectCallType(req.body);

  const responseMap = {
    merchant: MERCHANT_RESPONSE,
    product: PRODUCT_EXPANSION_RESPONSE,
    classification: CLASSIFICATION_RESPONSE,
    insight: { text: INSIGHT_RESPONSE },
  };

  const responseBody = responseMap[callType];
  const isTextOnly = callType === 'insight';

  res.json({
    output: {
      message: {
        role: 'assistant',
        content: [{ text: isTextOnly ? INSIGHT_RESPONSE : JSON.stringify(responseBody) }],
      },
    },
    stopReason: 'end_turn',
    usage: { inputTokens: 300, outputTokens: 80 },
  });
}
