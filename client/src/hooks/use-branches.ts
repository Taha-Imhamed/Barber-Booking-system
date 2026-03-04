import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type BranchType, buildUrl } from "@shared/routes";

export function useBranches() {
  return useQuery<BranchType[]>({
    queryKey: [api.branches.list.path],
    queryFn: async () => {
      const res = await fetch(api.branches.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<BranchType, "id">) => {
      const res = await fetch(api.branches.create.path, {
        method: api.branches.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create branch");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.branches.list.path] });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.branches.delete.path, { id }), {
        method: api.branches.delete.method,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to delete branch" }));
        throw new Error(err.message || "Failed to delete branch");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.branches.list.path] });
    },
  });
}
