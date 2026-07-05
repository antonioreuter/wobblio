export interface BillSplitMeta {
  id: string;
  invoiceId: string;
}

export interface StoredAllocation {
  lineId: string;
  participantNameEnc: string;
  units: number;
}

export interface LineAllocationInput {
  participantNameEnc: string;
  units: number;
}

export interface IBillSplitRepository {
  create(invoiceId: string): Promise<string>;
  getMeta(splitId: string): Promise<BillSplitMeta | null>;
  listAllocations(splitId: string): Promise<StoredAllocation[]>;
  // Replaces all allocations for a single line atomically (delete + insert).
  setLineAllocations(splitId: string, lineId: string, allocations: LineAllocationInput[]): Promise<void>;
}
