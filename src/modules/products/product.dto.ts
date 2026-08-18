export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  price: string;
}

export interface UpdateProductDto {
  code?: string;
  name?: string;
  description?: string | null;
  price?: string;
  active?: boolean;
}