import { apiFetch } from "@/lib/api";
import type { CreateSlotsInput, HostSlot } from "@/lib/schemas/slots";

export const getHostSlots = () => apiFetch<HostSlot[]>("/api/host/slots?includePast=false");

export const createSlots = (input: CreateSlotsInput) => apiFetch<HostSlot[]>("/api/host/slots", { method: "POST", body: input });

export const deleteSlot = (id: string) => apiFetch<void>(`/api/host/slots/${id}`, { method: "DELETE" });

export const cancelBooking = (id: string) => apiFetch<void>(`/api/host/bookings/${id}`, { method: "DELETE" });
