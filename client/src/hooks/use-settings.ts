import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function usePublicSettings() {
  return useQuery<{
    wallDisplayBackground: string;
    notificationSound: "chime" | "beep" | "ding";
    wallShowWeather: boolean;
    wallShowMusic: boolean;
    wallQueueLimit: number;
  }>({
    queryKey: [api.settings.public.path],
    queryFn: async () => {
      const res = await fetch(api.settings.public.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useSaveAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      wallDisplayBackground?: string;
      notificationSound?: "chime" | "beep" | "ding";
      wallShowWeather?: boolean;
      wallShowMusic?: boolean;
      wallQueueLimit?: number;
    }) => {
      const res = await fetch(api.admin.settings.path, {
        method: api.admin.settings.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save settings");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.settings.public.path] });
    },
  });
}
