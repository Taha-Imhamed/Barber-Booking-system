import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useEarningsSummary() {
  return useQuery<{
    barberDailyTotal: number;
    branchDailyTotal: number;
    totalProfit: number;
    totalExpenses: number;
    netProfit: number;
    branchTotals: { branchId: number; branchName: string; total: number }[];
    barberTotals: { barberId: number; barberName: string; total: number }[];
  }>({
    queryKey: [api.earnings.summary.path],
    queryFn: async () => {
      const res = await fetch(api.earnings.summary.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch earnings");
      return res.json();
    },
    refetchInterval: 5000,
  });
}
