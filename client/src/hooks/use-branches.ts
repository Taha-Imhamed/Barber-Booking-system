import { useQuery } from "@tanstack/react-query";
import { api, type BranchType } from "@shared/routes";

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
