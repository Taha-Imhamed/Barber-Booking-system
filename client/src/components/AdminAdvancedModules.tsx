import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAnalyticsDashboard, useInventory, useReviewsAdmin, useTagsCampaigns } from "@/hooks/use-advanced";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AdminAdvancedModules() {
  const { toast } = useToast();
  const { data: analytics } = useAnalyticsDashboard();
  const inventory = useInventory();
  const reviews = useReviewsAdmin();
  const tagsCampaigns = useTagsCampaigns();

  const [productName, setProductName] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [price, setPrice] = useState("0");

  const [newTag, setNewTag] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignChannel, setCampaignChannel] = useState<"email" | "sms">("email");
  const [targetTagId, setTargetTagId] = useState<string>("all");

  const bookingsPerDay = useMemo(() => analytics?.bookingsPerDay ?? [], [analytics]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-zinc-500">Most Popular Service</p>
              <p className="font-semibold">{analytics?.mostPopularService ?? "-"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-zinc-500">Busiest Barber</p>
              <p className="font-semibold">{analytics?.busiestBarber ?? "-"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-zinc-500">Monthly Revenue</p>
              <p className="font-semibold">${analytics?.monthlyRevenue ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="h-72 rounded-lg border p-2">
              <p className="text-sm font-medium px-2">Bookings per Day</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={bookingsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-72 rounded-lg border p-2">
              <p className="text-sm font-medium px-2">Booking Trend</p>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={bookingsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#1d4ed8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <Input type="number" placeholder="Stock" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} />
            <Input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Button
              onClick={async () => {
                try {
                  await inventory.create.mutateAsync({
                    productName,
                    stockQuantity: Number.parseInt(stockQuantity, 10) || 0,
                    price: Number.parseInt(price, 10) || 0,
                  });
                  setProductName("");
                  setStockQuantity("0");
                  setPrice("0");
                  toast({ title: "Inventory item created" });
                } catch (err: any) {
                  toast({ variant: "destructive", title: "Error", description: err.message });
                }
              }}
            >
              Add Product
            </Button>
          </div>
          <div className="space-y-2">
            {(inventory.list.data ?? []).map((item: any) => (
              <div key={item.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-xs text-zinc-500">Stock: {item.stock_quantity} | Price: ${item.price}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await inventory.sale.mutateAsync({ id: item.id, quantity: 1 });
                      toast({ title: "1 unit sold" });
                    } catch (err: any) {
                      toast({ variant: "destructive", title: "Sale failed", description: err.message });
                    }
                  }}
                >
                  Sell 1
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Reviews Moderation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(reviews.list.data ?? []).slice(0, 20).map((r: any) => (
              <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">Rating: {r.rating}/5</p>
                  <p className="text-xs text-zinc-500">{r.comment || "No comment"}</p>
                </div>
                <Button
                  size="sm"
                  variant={r.is_approved ? "outline" : "default"}
                  onClick={async () => {
                    try {
                      await reviews.moderate.mutateAsync({ id: r.id, isApproved: !r.is_approved });
                      toast({ title: !r.is_approved ? "Review approved" : "Review hidden" });
                    } catch (err: any) {
                      toast({ variant: "destructive", title: "Error", description: err.message });
                    }
                  }}
                >
                  {r.is_approved ? "Unapprove" : "Approve"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags & Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="New tag (VIP)" />
              <Button
                onClick={async () => {
                  try {
                    await tagsCampaigns.createTag.mutateAsync(newTag);
                    setNewTag("");
                    toast({ title: "Tag created" });
                  } catch (err: any) {
                    toast({ variant: "destructive", title: "Error", description: err.message });
                  }
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(tagsCampaigns.tags.data ?? []).map((t: any) => (
                <span key={t.id} className="px-2 py-1 rounded bg-zinc-100 text-xs">{t.name}</span>
              ))}
            </div>
            <Input value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} placeholder="Campaign title" />
            <Textarea value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)} placeholder="Campaign message" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={campaignChannel} onValueChange={(v) => setCampaignChannel(v as "email" | "sms")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={targetTagId} onValueChange={setTargetTagId}>
                <SelectTrigger><SelectValue placeholder="Target tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {(tagsCampaigns.tags.data ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={async () => {
                try {
                  await tagsCampaigns.sendCampaign.mutateAsync({
                    title: campaignTitle,
                    message: campaignMessage,
                    channel: campaignChannel,
                    targetTagId: targetTagId === "all" ? undefined : Number.parseInt(targetTagId, 10),
                  });
                  setCampaignTitle("");
                  setCampaignMessage("");
                  setTargetTagId("all");
                  toast({ title: "Campaign sent" });
                } catch (err: any) {
                  toast({ variant: "destructive", title: "Error", description: err.message });
                }
              }}
            >
              Send Campaign
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
