CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "slot" (
    "id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "confirmation_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slot_starts_at_idx" ON "slot"("starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_slot_id_key" ON "booking"("slot_id");

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level guarantees: a slot ends after it starts, slots never overlap, names are 1-80 chars.
ALTER TABLE "slot" ADD CONSTRAINT slot_ends_after_start CHECK (ends_at > starts_at);
ALTER TABLE "slot" ADD CONSTRAINT slot_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&);
ALTER TABLE "booking" ADD CONSTRAINT booking_name_len CHECK (char_length(name) BETWEEN 1 AND 80);
