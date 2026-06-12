import express, { Request, Response, NextFunction } from 'express';
import { visionHandler } from './handlers/vision';
import { auxiliaryHandler } from './handlers/auxiliary';
import { embedderHandler } from './handlers/embedder';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4577', 10);
const ERROR_RATE = parseFloat(process.env.ERROR_INJECTION_RATE ?? '0');

app.use(express.json({ limit: '10mb' }));

app.use((_req: Request, res: Response, next: NextFunction): void => {
  if (ERROR_RATE > 0 && Math.random() < ERROR_RATE) {
    res.status(500).json({
      __type: 'ThrottlingException',
      message: 'Rate exceeded (injected error for DLQ testing)',
    });
    return;
  }
  next();
});

app.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', service: 'bedrock-mock' });
});

app.post('/model/:modelId/converse', (req: Request, res: Response): void => {
  const { modelId } = req.params;
  if (modelId.includes('vision') || modelId.includes('mock-vision')) {
    visionHandler(req, res);
  } else {
    auxiliaryHandler(req, res);
  }
});

app.post('/model/:modelId/invoke', (req: Request, res: Response): void => {
  embedderHandler(req, res);
});

app.listen(PORT, () => {
  console.log(`Bedrock mock listening on port ${PORT}`);
  console.log(`Error injection rate: ${ERROR_RATE}`);
});
