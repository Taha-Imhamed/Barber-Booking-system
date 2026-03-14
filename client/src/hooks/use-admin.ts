import { useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useSendAdminMessage() {
  return useMutation({
    mutationFn: async (payload: { appointmentId: number; message: string }) => {
      const res = await fetch(api.admin.sendMessage.path, {
        method: api.admin.sendMessage.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to send message");
      return data;
    },
  });
}

export function useDeleteAdminUser() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.admin.deleteUser.path, { id }), {
        method: api.admin.deleteUser.method,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete user");
      return data;
    },
  });
}
