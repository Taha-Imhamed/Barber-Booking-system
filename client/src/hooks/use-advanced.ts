import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useAnalyticsDashboard() {
  return useQuery({
    queryKey: [api.analytics.dashboard.path],
    queryFn: async () => {
      const res = await fetch(api.analytics.dashboard.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function useInventory() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: [api.inventory.list.path],
    queryFn: async () => {
      const res = await fetch(api.inventory.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inventory");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async (payload: { productName: string; stockQuantity: number; price: number }) => {
      const res = await fetch(api.inventory.create.path, {
        method: api.inventory.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create inventory item");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] }),
  });

  const sale = useMutation({
    mutationFn: async ({ id, quantity }: { id: number; quantity: number }) => {
      const res = await fetch(buildUrl(api.inventory.sale.path, { id }), {
        method: api.inventory.sale.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Sale failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] }),
  });

  return { list, create, sale };
}

export function useReviewsAdmin() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: [api.reviews.list.path],
    queryFn: async () => {
      const res = await fetch(api.reviews.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reviews");
      return res.json();
    },
  });

  const moderate = useMutation({
    mutationFn: async ({ id, isApproved }: { id: number; isApproved: boolean }) => {
      const res = await fetch(buildUrl(api.reviews.moderate.path, { id }), {
        method: api.reviews.moderate.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isApproved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Moderation failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.reviews.list.path] }),
  });

  return { list, moderate };
}

export function useTagsCampaigns() {
  const queryClient = useQueryClient();
  const tags = useQuery({
    queryKey: [api.customerTags.list.path],
    queryFn: async () => {
      const res = await fetch(api.customerTags.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tags");
      return res.json();
    },
  });

  const campaigns = useQuery({
    queryKey: [api.campaigns.list.path],
    queryFn: async () => {
      const res = await fetch(api.campaigns.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load campaigns");
      return res.json();
    },
  });

  const createTag = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(api.customerTags.create.path, {
        method: api.customerTags.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create tag");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.customerTags.list.path] }),
  });

  const sendCampaign = useMutation({
    mutationFn: async (payload: { title: string; message: string; channel: "email" | "sms"; targetTagId?: number }) => {
      const res = await fetch(api.campaigns.send.path, {
        method: api.campaigns.send.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to send campaign");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.campaigns.list.path] }),
  });

  return { tags, campaigns, createTag, sendCampaign };
}

export function useReferralCode() {
  return useQuery({
    queryKey: [api.referrals.myCode.path],
    queryFn: async () => {
      const res = await fetch(api.referrals.myCode.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load referral code");
      return res.json();
    },
  });
}

export function useApplyReferral() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(api.referrals.apply.path, {
        method: api.referrals.apply.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to apply referral");
      return data;
    },
  });
}

export function useNearestBranch(lat?: number, lng?: number) {
  return useQuery({
    queryKey: [api.geo.nearest.path, lat, lng],
    queryFn: async () => {
      const res = await fetch(`${api.geo.nearest.path}?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get nearest branch");
      return res.json();
    },
    enabled: Number.isFinite(lat) && Number.isFinite(lng),
  });
}

export function useBarberGallery(barberId?: number) {
  const barberIdNum = Number(barberId);
  return useQuery({
    queryKey: [api.gallery.list.path, barberIdNum],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.gallery.list.path, { barberId: barberIdNum }), { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load gallery");
      return res.json();
    },
    enabled: Number.isFinite(barberIdNum),
  });
}

export function useAddGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { barberId: number; imageUrl: string; caption?: string }) => {
      const res = await fetch(api.gallery.add.path, {
        method: api.gallery.add.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (data && typeof data === "object" && "message" in data ? String((data as any).message) : "") ||
          "Failed to add gallery item";
        throw new Error(message);
      }
      return data;
    },
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: [api.gallery.list.path, Number(vars.barberId)] }),
  });
}

export function useUpdateGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: number; barberId: number; imageUrl?: string; caption?: string }) => {
      const res = await fetch(buildUrl(api.gallery.update.path, { id: payload.id }), {
        method: api.gallery.update.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageUrl: payload.imageUrl, caption: payload.caption }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (data && typeof data === "object" && "message" in data ? String((data as any).message) : "") ||
          "Failed to update gallery item";
        throw new Error(message);
      }
      return data;
    },
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: [api.gallery.list.path, Number(vars.barberId)] }),
  });
}

export function useDeleteGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: number; barberId: number }) => {
      const res = await fetch(buildUrl(api.gallery.remove.path, { id: payload.id }), {
        method: api.gallery.remove.method,
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (data && typeof data === "object" && "message" in data ? String((data as any).message) : "") ||
          "Failed to delete gallery item";
        throw new Error(message);
      }
      return data;
    },
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: [api.gallery.list.path, Number(vars.barberId)] }),
  });
}

export function useLandingMedia() {
  return useQuery({
    queryKey: [api.landingMedia.get.path],
    queryFn: async () => {
      const res = await fetch(api.landingMedia.get.path, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load landing media");
      return res.json();
    },
  });
}

export function useSaveLandingMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      photos: { id: string; title: string; imageUrl: string }[];
      videos: { id: string; title: string; videoUrl: string }[];
    }) => {
      const res = await fetch(api.landingMedia.save.path, {
        method: api.landingMedia.save.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save landing media");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.landingMedia.get.path] }),
  });
}
