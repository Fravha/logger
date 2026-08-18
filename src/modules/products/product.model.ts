export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}