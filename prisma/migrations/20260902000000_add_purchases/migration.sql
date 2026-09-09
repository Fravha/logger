-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_reference_key" ON "purchases"("reference");
