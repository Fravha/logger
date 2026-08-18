import type { DocType } from "./doc-type.js";
import { productDocType } from "../products/product.doc-type.js";

export const businessDocTypes: readonly DocType[] = [productDocType];
