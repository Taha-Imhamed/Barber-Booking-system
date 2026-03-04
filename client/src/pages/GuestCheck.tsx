import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGuestAppointments, useRespondProposedTime } from "@/hooks/use-appointments";
import { useGuestNotifications, useMarkGuestNotificationRead } from "@/hooks/use-guest-notifications";
import { useToast } from "@/hooks/use-toast";

export default function GuestCheck() {
  const { toast } = useToast();
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const { data: appointments } = useGuestAppointments(phone);
  const { data: notifications } = useGuestNotifications(phone);
  const respond = useRespondProposedTime();
  const markRead = useMarkGuestNotificationRead();

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader><CardTitle>Check Appointment by Phone</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="Enter your phone number" />
              <Button onClick={() => setPhone(phoneInput.trim())} disabled={!phoneInput.trim()}>Check</Button>
            </div>
          </CardContent>
        </Card>

        {phone ? (
          <>
            <Card>
              <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(notifications ?? []).length === 0 && <p className="text-zinc-500">No notifications.</p>}
                {(notifications ?? []).map((n) => (
                  <div key={n.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{n.message}</p>
                      <p className="text-xs text-zinc-500">{format(new Date(n.createdAt || new Date()), "PPP p")}</p>
                    </div>
                    {!n.isRead && (
                      <Button size="sm" variant="outline" onClick={() => markRead.mutate(n.id)}>Read</Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(appointments ?? []).length === 0 && <p className="text-zinc-500">No appointments found for this phone.</p>}
                {(appointments ?? []).map((apt) => (
                  <div key={apt.id} className="border rounded-lg p-3 space-y-2">
                    <p className="font-semibold">#{apt.id} - {format(new Date(apt.appointmentDate), "PPP p")}</p>
                    <p className="text-sm uppercase text-zinc-600">Status: {apt.status}</p>
                    {apt.status === "postponed" && apt.proposedStatus === "pending_client" && apt.proposedDate && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                        <p className="text-sm mb-2">New proposed time: {format(new Date(apt.proposedDate), "PPP p")}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await respond.mutateAsync({ id: apt.id, action: "accept" });
                                toast({ title: "New time accepted" });
                              } catch (err: any) {
                                toast({ variant: "destructive", title: "Error", description: err.message });
                              }
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await respond.mutateAsync({ id: apt.id, action: "decline" });
                                toast({ title: "You asked for another time" });
                              } catch (err: any) {
                                toast({ variant: "destructive", title: "Error", description: err.message });
                              }
                            }}
                          >
                            Another Time
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

