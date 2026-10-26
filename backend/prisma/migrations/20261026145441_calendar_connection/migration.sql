-- CreateTable
CREATE TABLE "calendar_connection" (
    "id" TEXT NOT NULL DEFAULT 'host',
    "email" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "needs_reconnect" BOOLEAN NOT NULL DEFAULT false,
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_connection_pkey" PRIMARY KEY ("id")
);
