import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMarkNotificationRead, useNotifications } from "@/hooks/use-notifications";
import { useToast } from "@/hooks/use-toast";
import { playNotificationTone } from "@/lib/playNotificationTone";
import { usePublicSettings } from "@/hooks/use-settings";

export function NotificationWatcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: notifications } = useNotifications(user?.id);
  const { data: settings } = usePublicSettings();
  const markRead = useMarkNotificationRead();
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!notifications?.length) return;

    notifications.forEach((n) => {
      if (seen.current.has(n.id)) return;
      seen.current.add(n.id);
      if (n.isRead) return;

      toast({ title: "Notification", description: n.message });
      playNotificationTone(settings?.notificationSound ?? "chime");

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Barber Booking", { body: n.message });
      }
      // Auto-mark as read so notifications don't remain stuck forever.
      void markRead.mutateAsync(n.id).catch(() => {});
    });
  }, [notifications, toast, markRead]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  return null;
}
