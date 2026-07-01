export interface BillSplitMeta {
  id: string;
  invoiceId: string;
}

export interface StoredAssignment {
  lineId: string;
  participantNameEnc: string;
  fraction: number;
}

export interface IBillSplitRepository {
  create(invoiceId: string): Promise<string>;
  getMeta(splitId: string): Promise<BillSplitMeta | null>;
  listAssignments(splitId: string): Promise<StoredAssignment[]>;
  upsertAssignment(splitId: string, lineId: string, participantNameEnc: string, fraction: number): Promise<void>;
  removeAssignment(splitId: string, lineId: string): Promise<void>;
}
