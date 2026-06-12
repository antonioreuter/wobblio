import { Request, Response } from 'express';

const MOCK_VISION_RESPONSE = {
  merchant_block: {
    raw_name: 'Albert Heijn 1325',
    raw_address: 'Nachtegaallaan 1, 5613 CV Eindhoven',
    vat_or_registration_id: 'NL001234567B01',
    phone: null,
  },
  transaction: {
    date: '2026-06-10',
    time: '14:23',
    currency: 'EUR',
    total: 12.45,
    taxes: [
      { rate_label: 'BTW 9%', amount: 0.88 },
      { rate_label: 'BTW 21%', amount: 0.72 },
    ],
    service_fee: null,
    tip: null,
  },
  line_items: [
    {
      raw_text: 'AH BIO HALFV MELK 1L',
      quantity: 2,
      unit_size_raw: '1L',
      unit_price: 1.19,
      line_total: 2.38,
      discount_flag: false,
    },
    {
      raw_text: 'JUMB ROOMBOTER ONGEZ 250G',
      quantity: 1,
      unit_size_raw: '250G',
      unit_price: 2.49,
      line_total: 2.49,
      discount_flag: false,
    },
    {
      raw_text: 'LIDL VOLLK BROT 750G',
      quantity: 1,
      unit_size_raw: '750G',
      unit_price: 1.89,
      line_total: 1.89,
      discount_flag: false,
    },
  ],
  document_kind_hint: 'RECEIPT',
  parse_confidence: 0.95,
};

export function visionHandler(_req: Request, res: Response): void {
  res.json({
    output: {
      message: {
        role: 'assistant',
        content: [{ text: JSON.stringify(MOCK_VISION_RESPONSE) }],
      },
    },
    stopReason: 'end_turn',
    usage: { inputTokens: 500, outputTokens: 200 },
  });
}
