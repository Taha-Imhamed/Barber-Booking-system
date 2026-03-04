import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UserType, buildUrl } from "@shared/routes";

export function useBarbers() {
  return useQuery<UserType[]>({
    queryKey: [api.barbers.list.path],
    queryFn: async () => {
      const res = await fetch(api.barbers.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch barbers");
      return res.json();
    },
  });
}

export function useCreateBarber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.barbers.create.path, {
        method: api.barbers.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create barber");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.barbers.list.path] });
    },
  });
}

export function useUpdateBarber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserType> }) => {
      const res = await fetch(buildUrl(api.barbers.update.path, { id }), {
        method: api.barbers.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update barber");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.barbers.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });
}

export function useDeleteBarber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.barbers.delete.path, { id }), {
        method: api.barbers.delete.method,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete barber");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.barbers.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
    },
  });
}
