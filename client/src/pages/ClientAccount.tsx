import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Bell, CalendarClock, Gem, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments } from "@/hooks/use-appointments";
import { useRespondProposedTime } from "@/hooks/use-appointments";
import { useBarbers } from "@/hooks/use-barbers";
import { useServices } from "@/hooks/use-services";
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@/hooks/use-notifications";
import { useApplyReferral, useReferralCode } from "@/hooks/use-advanced";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { formatLekFromCents } from "@/lib/money";

export default function ClientAccount() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { data: appointments } = useAppointments();
  const { data: barbers } = useBarbers();
  const { data: services } = useServices();
  const { data: notifications } = useNotifications(user?.id);
  const respond = useRespondProposedTime();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const { toast } = useToast();
  const referral = useReferralCode();
  const applyReferral = useApplyReferral();
  const [openedMessage, setOpenedMessage] = useState<string>("");
  const [referralInput, setReferralInput] = useState("");
  const [ratingByAppointment, setRatingByAppointment] = useState<Record<number, number>>({});
  const [commentByAppointment, setCommentByAppointment] = useState<Record<number, string>>({});
  const [reviewedAppointments, setReviewedAppointments] = useState<Set<number>>(new Set());

  const barberById = useMemo(() => new Map(barbers?.map((b) => [Number(b.id), `${b.firstName} ${b.lastName}`]) ?? []), [barbers]);
  const serviceById = useMemo(() => new Map(services?.map((s) => [Number(s.id), s.name]) ?? []), [services]);

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading...</div>;
  if (!user || user.role !== "client") return <div className="p-8 text-center text-red-500">Client account only.</div>;

  const myAppointments = appointments?.filter((a) => Number(a.clientId) === Number(user.id)) ?? [];
  const upcoming = myAppointments.filter((a) => ["pending", "accepted", "postponed"].includes(a.status));
  const history = myAppointments.filter((a) => ["completed", "rejected"].includes(a.status));
  const unread = notifications?.filter((n) => !n.isRead).length ?? 0;

  useEffect(() => {
    fetch(api.reviews.list.path, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const ids = new Set<number>((rows ?? []).filter((r: any) => Number(r.client_id) === Number(user.id)).map((r: any) => Number(r.appointment_id)));
        setReviewedAppointments(ids);
      })
      .catch(() => {});
  }, [user.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold">My Account</h1>
            <p className="text-zinc-600">Track bookings, points, and notifications.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/")}>Home</Button>
            <Button variant="destructive" onClick={() => { logout(); setLocation("/"); }}>
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-500">Upcoming</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{upcoming.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-500 flex items-center gap-2"><Gem className="w-4 h-4" /> Loyalty Points</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{user.loyaltyPoints ?? 0}</p>
              <p className="text-xs text-zinc-500 mt-1">Credits: {formatLekFromCents(Number(user.bookingCreditCents ?? 0))}</p>
              {user.isFlaggedNoShow ? <p className="text-xs text-red-600 mt-1">Warning: account flagged for repeated no-shows.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-500 flex items-center gap-2"><Bell className="w-4 h-4" /> Unread Notifications</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{unread}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">Appointment History</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="rewards">Rewards & Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4 mt-4">
            {[...upcoming, ...history].length === 0 ? (
              <Card><CardContent className="p-6 text-zinc-500">No appointments yet.</CardContent></Card>
            ) : (
              [...upcoming, ...history].map((apt) => (
                <Card key={apt.id}>
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-lg">
                        {serviceById.get(Number(apt.serviceId)) ?? `Service #${apt.serviceId}`}
                      </p>
                      <p className="text-sm text-zinc-600">
                        Barber: {barberById.get(Number(apt.barberId)) ?? `#${apt.barberId}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium flex items-center gap-2 justify-end"><CalendarClock className="w-4 h-4" />{format(new Date(apt.appointmentDate), "PPP p")}</p>
                      <p className="text-sm uppercase tracking-wider text-zinc-500">{apt.status}</p>
                      {apt.status === "postponed" && apt.proposedStatus === "pending_client" && apt.proposedDate && (
                        <div className="postpone-panel mt-2 space-y-2 p-3 rounded-md">
                          <p className="text-sm text-amber-700">Proposed time: {format(new Date(apt.proposedDate), "PPP p")}</p>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={() => respond.mutate({ id: apt.id, action: "accept" })}>Accept</Button>
                            <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: apt.id, action: "decline" })}>Another Time</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>Mark All Read</Button>
            </div>
            {openedMessage && (
              <Card className="border-orange-300 bg-orange-50">
                <CardContent className="p-4">
                  <p className="font-medium">{openedMessage}</p>
                </CardContent>
              </Card>
            )}
            {notifications?.length ? (
              notifications.map((n) => (
                <Card key={n.id} className={!n.isRead ? "border-amber-300" : ""}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{n.message}</p>
                      <p className="text-xs text-zinc-500">{format(new Date(n.createdAt || new Date()), "PPP p")}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOpenedMessage(n.message);
                        if (!n.isRead) markRead.mutate(n.id);
                      }}
                      disabled={markRead.isPending}
                    >
                      {n.isRead ? "Open" : "Read"}
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card><CardContent className="p-6 text-zinc-500">No notifications.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle>Referral Program</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-600">Your code: <span className="font-semibold">{referral.data?.code ?? "Loading..."}</span></p>
                <div className="flex gap-2">
                  <Input value={referralInput} onChange={(e) => setReferralInput(e.target.value)} placeholder="Enter a friend's referral code" />
                  <Button
                    onClick={async () => {
                      try {
                        await applyReferral.mutateAsync(referralInput);
                        setReferralInput("");
                        toast({ title: "Referral applied", description: "You and your friend received booking credit." });
                      } catch (err: any) {
                        toast({ variant: "destructive", title: "Referral failed", description: err.message });
                      }
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Rate Completed Appointments</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {myAppointments.filter((a) => a.status === "completed").map((apt) => {
                  const already = reviewedAppointments.has(Number(apt.id));
                  return (
                    <div key={`review-${apt.id}`} className="border rounded-lg p-3 space-y-2">
                      <p className="font-medium">{serviceById.get(Number(apt.serviceId)) ?? `Service #${apt.serviceId}`} ({format(new Date(apt.appointmentDate), "PPP p")})</p>
                      {already ? (
                        <p className="text-xs text-emerald-700">You already reviewed this appointment.</p>
                      ) : (
                        <>
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={String(ratingByAppointment[apt.id] ?? "")}
                            onChange={(e) => setRatingByAppointment((prev) => ({ ...prev, [apt.id]: Number(e.target.value) }))}
                            placeholder="Rating (1-5)"
                          />
                          <Textarea
                            value={commentByAppointment[apt.id] ?? ""}
                            onChange={(e) => setCommentByAppointment((prev) => ({ ...prev, [apt.id]: e.target.value }))}
                            placeholder="Comment (optional)"
                          />
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const rating = Number(ratingByAppointment[apt.id] ?? 0);
                                if (rating < 1 || rating > 5) throw new Error("Rating must be 1-5.");
                                const res = await fetch(api.reviews.create.path, {
                                  method: api.reviews.create.method,
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({ appointmentId: apt.id, rating, comment: commentByAppointment[apt.id] || undefined }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(data.message || "Failed to submit review");
                                setReviewedAppointments((prev) => new Set([...Array.from(prev), Number(apt.id)]));
                                toast({ title: "Review submitted", description: "Pending admin approval." });
                              } catch (err: any) {
                                toast({ variant: "destructive", title: "Review failed", description: err.message });
                              }
                            }}
                          >
                            Submit Review
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
