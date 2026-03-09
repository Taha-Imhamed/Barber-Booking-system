import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGuestAppointments, useRespondProposedTime } from "@/hooks/use-appointments";
import { useGuestNotifications, useMarkGuestNotificationRead } from "@/hooks/use-guest-notifications";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

export default function GuestCheck() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [openedMessage, setOpenedMessage] = useState<string>("");
  const { data: appointments } = useGuestAppointments(phone);
  const { data: notifications } = useGuestNotifications(phone);
  const respond = useRespondProposedTime();
  const markRead = useMarkGuestNotificationRead();

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader><CardTitle>{t("checkByPhoneTitle")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder={t("enterPhone")} />
              <Button onClick={() => setPhone(phoneInput.trim())} disabled={!phoneInput.trim()}>{t("check")}</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/auth"><Button size="sm" variant="outline">{t("login")}</Button></Link>
              <Link href="/"><Button size="sm" variant="outline">{t("backToBooking")}</Button></Link>
            </div>
          </CardContent>
        </Card>

        {phone ? (
          <>
            {openedMessage && (
              <Card className="border-orange-300 bg-orange-50 dark:bg-zinc-900 dark:border-orange-500/60">
                <CardHeader><CardTitle className="text-base">{t("openedMessage")}</CardTitle></CardHeader>
                <CardContent><p>{openedMessage}</p></CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle>{t("notifications")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(notifications ?? []).length === 0 && <p className="text-zinc-500">{t("noNotifications")}</p>}
                {(notifications ?? []).map((n) => (
                  <div key={n.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
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
                    >
                      {n.isRead ? t("openMessage") : t("readMessage")}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("appointments")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(appointments ?? []).length === 0 && <p className="text-zinc-500">{t("noAppointmentsForPhone")}</p>}
                {(appointments ?? []).map((apt) => (
                  <div key={apt.id} className="border rounded-lg p-3 space-y-2">
                    <p className="font-semibold">#{apt.id} - {format(new Date(apt.appointmentDate), "PPP p")}</p>
                    <p className="text-sm uppercase text-zinc-600">{t("status")}: {apt.status}</p>
                    {apt.status === "postponed" && apt.proposedStatus === "pending_client" && apt.proposedDate && (
                      <div className="postpone-panel rounded-md p-3">
                        <p className="text-sm mb-2">{t("newProposedTime")}: {format(new Date(apt.proposedDate), "PPP p")}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await respond.mutateAsync({ id: apt.id, action: "accept" });
                                toast({ title: t("newTimeAccepted") });
                              } catch (err: any) {
                                toast({ variant: "destructive", title: t("error"), description: err.message });
                              }
                            }}
                          >
                            {t("accept")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await respond.mutateAsync({ id: apt.id, action: "decline" });
                                toast({ title: t("askedAnotherTime") });
                              } catch (err: any) {
                                toast({ variant: "destructive", title: t("error"), description: err.message });
                              }
                            }}
                          >
                            {t("anotherTime")}
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
