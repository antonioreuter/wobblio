export interface ExportMessage {
  requestId: string;
  tenantId: string;
}

export interface IExportQueue {
  enqueue(message: ExportMessage): Promise<void>;
}
