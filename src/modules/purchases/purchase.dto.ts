export interface CreatePurchaseDto {
  reference: string;
  supplierName: string;
  total: string;
  purchasedAt: Date;
}

export interface UpdatePurchaseDto {
  reference?: string;
  supplierName?: string;
  total?: string;
  purchasedAt?: Date;
}
