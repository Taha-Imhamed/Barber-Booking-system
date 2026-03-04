import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type NotificationType } from "@shared/routes";

export function useNotifications(userId?: number) {
  return useQuery<NotificationType[]>({
    queryKey: [api.notifications.list.path, userId ?? "me"],
    queryFn: async () => {
      const query = typeof userId === "number" ? `?userId=${userId}` : "";
      const res = await fetch(`${api.notifications.list.path}${query}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 5000,
    enabled: typeof userId === "number",
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.notifications.markRead.path, { id });
      const res = await fetch(url, {
        method: api.notifications.markRead.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.notifications.markAllRead.path, {
        method: api.notifications.markAllRead.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear notifications");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
    },
  });
}
