import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UserType } from "@shared/routes";

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
