import { apiFetch } from "@/lib/api";
import type { AppConfig } from "@/lib/schemas/slots";

export const getConfig = () => apiFetch<AppConfig>("/api/config");
