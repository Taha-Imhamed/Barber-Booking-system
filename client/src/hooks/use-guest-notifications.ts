import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type GuestNotificationType } from "@shared/routes";

export function useGuestNotifications(phone?: string) {
  return useQuery<GuestNotificationType[]>({
    queryKey: [api.guestNotifications.list.path, phone ?? ""],
    queryFn: async () => {
      const res = await fetch(`${api.guestNotifications.list.path}?phone=${encodeURIComponent(phone ?? "")}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch guest notifications");
      return res.json();
    },
    enabled: Boolean(phone),
    refetchInterval: 5000,
  });
}

export function useMarkGuestNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.guestNotifications.markRead.path, { id }), {
        method: api.guestNotifications.markRead.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark guest notification read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.guestNotifications.list.path] });
    },
  });
}

