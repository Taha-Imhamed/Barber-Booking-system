import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AppointmentType, buildUrl } from "@shared/routes";

export function useAppointments() {
  return useQuery<AppointmentType[]>({
    queryKey: [api.appointments.list.path],
    queryFn: async () => {
      const res = await fetch(api.appointments.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
    // Poll frequently for the display page
    refetchInterval: 5000, 
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.appointments.create.path, {
        method: api.appointments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, tipAmount, proposedDate }: { id: number; status: string; tipAmount?: number; proposedDate?: string }) => {
      const url = buildUrl(api.appointments.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.appointments.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, tipAmount, proposedDate }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update appointment status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
    },
  });
}

export function useGuestAppointments(phone?: string) {
  return useQuery<AppointmentType[]>({
    queryKey: [api.appointments.guestByPhone.path, phone ?? ""],
    queryFn: async () => {
      const res = await fetch(`${api.appointments.guestByPhone.path}?phone=${encodeURIComponent(phone ?? "")}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch guest appointments");
      return res.json();
    },
    enabled: Boolean(phone),
    refetchInterval: 5000,
  });
}

export function useRespondProposedTime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "decline" }) => {
      const url = buildUrl(api.appointments.respondProposedTime.path, { id });
      const res = await fetch(url, {
        method: api.appointments.respondProposedTime.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to respond");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.appointments.guestByPhone.path] });
    },
  });
}
