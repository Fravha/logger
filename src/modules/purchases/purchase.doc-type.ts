import type { DocType } from "../doc-types/doc-type.js";
import type { PurchaseApi } from "./purchase.api.js";
import { PrismaPurchaseRepository } from "./prisma-purchase.repository.js";
import { PrismaPurchaseUnitOfWork } from "./prisma-purchase.unit-of-work.js";
import { createPurchaseRouter } from "./purchase.routes.js";
import { PurchaseService } from "./purchase.service.js";

export const purchaseDocType: DocType<PurchaseApi> = {
  name: "purchases",
  route: "/purchases",
  permissions: [
    { code: "purchases:read", name: "Read purchases" },
    { code: "purchases:create", name: "Create purchases" },
    { code: "purchases:update", name: "Update purchases" },
    { code: "purchases:delete", name: "Delete purchases" },
  ],
  register(dependencies) {
    const service = new PurchaseService(new PrismaPurchaseRepository(dependencies.prisma), new PrismaPurchaseUnitOfWork(dependencies.prisma));
    return { api: service, router: createPurchaseRouter(dependencies.tokenVerifier, dependencies.userRepository, service) };
  },
};
