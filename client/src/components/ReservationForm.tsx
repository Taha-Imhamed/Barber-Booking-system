import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Scissors, User as UserIcon, Clock, ShieldCheck, CircleAlert, Wallet } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useBranches } from "@/hooks/use-branches";
import { useServices } from "@/hooks/use-services";
import { useBarbers } from "@/hooks/use-barbers";
import { useAppointments, useCreateAppointment } from "@/hooks/use-appointments";
import { cn } from "@/lib/utils";
import { formatLek } from "@/lib/money";
import { useI18n } from "@/i18n";
import { api } from "@shared/routes";
import { useNearestBranch } from "@/hooks/use-advanced";

export function ReservationForm({ preselectedBarberId }: { preselectedBarberId?: number | null }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const { data: branches, isLoading: isLoadingBranches } = useBranches();
  const { data: services, isLoading: isLoadingServices } = useServices();
  const { data: barbers, isLoading: isLoadingBarbers } = useBarbers();
  const { data: appointments } = useAppointments();
  const createAppointment = useCreateAppointment();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    branchId: "",
    serviceId: "",
    barberId: "",
    appointmentDate: new Date(),
    timeSlot: "",
    guestFirstName: "",
    guestLastName: "",
    guestPhone: "",
    guestEmail: "",
    paymentMethod: "cash_on_arrival",
  });
  const [extraServiceIds, setExtraServiceIds] = useState<number[]>([]);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const nearestBranch = useNearestBranch(geoCoords?.lat, geoCoords?.lng);

  const updateForm = (key: keyof typeof formData, value: string | Date) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setStep(1);
    setFormData((prev) => ({
      ...prev,
      branchId: "",
      serviceId: "",
      barberId: "",
      timeSlot: "",
      guestFirstName: "",
      guestLastName: "",
      guestPhone: "",
      guestEmail: "",
      paymentMethod: "cash_on_arrival",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedBranchId = Number.parseInt(formData.branchId, 10);
      const parsedServiceId = Number.parseInt(formData.serviceId, 10);
      const parsedBarberId = Number.parseInt(effectiveBarberId, 10);
      const parsedClientId = user?.id == null ? null : Number(user.id);
      const [hours, minutes] = formData.timeSlot.split(":");
      const finalDate = new Date(formData.appointmentDate);
      finalDate.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

      if (!Number.isFinite(parsedBranchId) || !Number.isFinite(parsedServiceId) || !Number.isFinite(parsedBarberId)) {
        throw new Error(t("selectRequiredFields"));
      }
      if (user && !Number.isFinite(parsedClientId)) {
        throw new Error(t("invalidSession"));
      }
      const barberForBranch = barbers?.find((b) => Number(b.id) === parsedBarberId);
      if (barberForBranch?.branchId != null && Number(barberForBranch.branchId) !== parsedBranchId) {
        throw new Error(t("barberWrongBranch"));
      }

      const payload: Record<string, unknown> = {
        branchId: parsedBranchId,
        serviceId: parsedServiceId,
        serviceIds: [parsedServiceId, ...extraServiceIds.filter((id) => id !== parsedServiceId)],
        barberId: parsedBarberId,
        appointmentDate: finalDate.toISOString(),
        status: "pending",
        paymentMethod: formData.paymentMethod,
        paymentStatus: "unpaid",
        prepaidAmount: 0,
      };

      if (user) {
        payload.clientId = parsedClientId;
      } else {
        if (!formData.guestEmail.trim()) {
          throw new Error("Email is required so we can send your reservation updates.");
        }
        payload.guestFirstName = formData.guestFirstName;
        payload.guestLastName = formData.guestLastName;
        payload.guestPhone = formData.guestPhone;
        payload.guestEmail = formData.guestEmail.trim();
      }

      await createAppointment.mutateAsync(payload);

      toast({
        title: t("reservationSubmitted"),
        description: t("reservationSubmittedDesc"),
      });

      resetForm();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("reservationFailed"),
        description: error.message || t("tryAgain"),
      });
    }
  };

  const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const minimumBarberLockMinutes = 120;
  const barbersForBranch = barbers?.filter((b) => {
    if (b.role !== "barber") return false;
    if (b.isAvailable === false) return false;
    if (formData.branchId && b.branchId !== Number(formData.branchId)) return false;
    return true;
  });
  const selectedBarber = barbers?.find((b) => Number(b.id) === Number(preselectedBarberId));

  const effectiveBarberId = preselectedBarberId ? String(preselectedBarberId) : formData.barberId;
  const selectedBarberByChoice = barbers?.find((b) => Number(b.id) === Number(effectiveBarberId));
  const selectedService = services?.find((s) => Number(s.id) === Number(formData.serviceId));
  const selectedServices = (services ?? []).filter((s) => [Number(formData.serviceId), ...extraServiceIds].includes(Number(s.id)));
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price ?? 0), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + Number(s.durationMinutes ?? 0), 0);
  const blockedHours = (() => {
    if (!selectedBarberByChoice?.unavailableHours) return [];
    try {
      const parsed = JSON.parse(selectedBarberByChoice.unavailableHours);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  })();
  const blockedByBookings = (() => {
    if (!selectedBarberByChoice || !selectedService || !formData.appointmentDate) return [];
    const serviceById = new Map((services ?? []).map((s) => [Number(s.id), s]));
    const blockingStatuses = new Set(["pending", "accepted", "postponed"]);
    const dayStart = new Date(formData.appointmentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const sameDayAppointments = (appointments ?? []).filter((a) => {
      if (Number(a.barberId) !== Number(selectedBarberByChoice.id)) return false;
      if (!blockingStatuses.has(a.status)) return false;
      const apptStartRaw =
        a.status === "postponed" && a.proposedStatus === "pending_client" && a.proposedDate
          ? new Date(a.proposedDate)
          : new Date(a.appointmentDate);
      return apptStartRaw >= dayStart && apptStartRaw < dayEnd;
    });
    return timeSlots.filter((slot) => {
      const [hh, mm] = slot.split(":");
      const candidateStart = new Date(formData.appointmentDate);
      candidateStart.setHours(Number(hh), Number(mm), 0, 0);
      const candidateLockMinutes = Math.max(selectedService.durationMinutes, minimumBarberLockMinutes);
      const candidateEnd = new Date(candidateStart.getTime() + candidateLockMinutes * 60 * 1000);
      return sameDayAppointments.some((a) => {
        const existingService = serviceById.get(Number(a.serviceId));
        if (!existingService) return false;
        const existingStart =
          a.status === "postponed" && a.proposedStatus === "pending_client" && a.proposedDate
            ? new Date(a.proposedDate)
            : new Date(a.appointmentDate);
        const existingLockMinutes = Math.max(existingService.durationMinutes, minimumBarberLockMinutes);
        const existingEnd = new Date(existingStart.getTime() + existingLockMinutes * 60 * 1000);
        return candidateStart < existingEnd && candidateEnd > existingStart;
      });
    });
  })();
  const blockedSlotSet = new Set([...blockedHours, ...blockedByBookings]);

  useEffect(() => {
    if (formData.timeSlot && blockedSlotSet.has(formData.timeSlot)) {
      setFormData((prev) => ({ ...prev, timeSlot: "" }));
    }
  }, [formData.timeSlot, formData.appointmentDate, effectiveBarberId, selectedService?.id]);

  useEffect(() => {
    if (!formData.serviceId) {
      setExtraServiceIds([]);
      return;
    }
    const mainId = Number(formData.serviceId);
    const validIds = new Set((services ?? []).map((s) => Number(s.id)));
    setExtraServiceIds((prev) =>
      prev.filter((id) => id !== mainId && validIds.has(id)),
    );
  }, [formData.serviceId, services]);

  useEffect(() => {
    if (!nearestBranch.data?.id) return;
    setFormData((prev) => ({ ...prev, branchId: String(nearestBranch.data.id) }));
  }, [nearestBranch.data?.id]);

  return (
    <Card className="glass-panel text-zinc-900 dark:text-zinc-100 w-full max-w-xl mx-auto overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-200">
        <div className="h-full bg-zinc-900 transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <CardHeader className="pt-5 sm:pt-7">
        <CardTitle className="text-2xl sm:text-3xl text-center">{t("bookYourAppointment")}</CardTitle>
        <CardDescription className="text-center text-sm text-zinc-500 dark:text-zinc-300">{t("stepOf3")} {step} {t("of")} 3</CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200"><MapPin className="w-4 h-4" /> {t("branch")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    });
                  }}
                >
                  Detect nearest branch
                </Button>
                {nearestBranch.data ? (
                  <p className="text-xs text-zinc-500">
                    Nearest: {nearestBranch.data.name} ({Number(nearestBranch.data.distanceKm ?? 0).toFixed(1)} km)
                    {" "}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nearestBranch.data.latitude},${nearestBranch.data.longitude}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Open in Google Maps
                    </a>
                  </p>
                ) : null}
                <Select value={formData.branchId} onValueChange={(v) => updateForm("branchId", v)}>
                  <SelectTrigger className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                    <SelectValue placeholder={isLoadingBranches ? t("loading") : t("selectBranch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name} - {branch.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200"><Scissors className="w-4 h-4" /> {t("service")}</Label>
                <Select value={formData.serviceId} onValueChange={(v) => updateForm("serviceId", v)}>
                  <SelectTrigger className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                    <SelectValue placeholder={isLoadingServices ? t("loading") : t("selectService")} />
                  </SelectTrigger>
                  <SelectContent>
                    {services?.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name} - {formatLek(service.price)} ({service.durationMinutes}m)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.serviceId && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 p-3 space-y-3">
                    <div className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {selectedService?.name ?? "Selected service"} - {formatLek(Number(selectedService?.price ?? 0))} ({selectedService?.durationMinutes ?? 0}m)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Add more services (optional)</p>
                      <div className="space-y-2 max-h-44 overflow-auto pr-1">
                        {(services ?? []).filter((s) => String(s.id) !== formData.serviceId).map((service) => {
                          const checked = extraServiceIds.includes(Number(service.id));
                          return (
                            <label
                              key={`extra-service-${service.id}`}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                                checked
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <span>{service.name} ({formatLek(service.price)}, {service.durationMinutes}m)</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                className="h-4 w-4 accent-zinc-900"
                                onChange={(e) =>
                                  setExtraServiceIds((prev) =>
                                    e.target.checked
                                      ? [...prev, Number(service.id)]
                                      : prev.filter((id) => id !== Number(service.id)),
                                  )
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                      <p className="text-sm font-semibold text-emerald-800">Total: {formatLek(totalPrice)} / {totalDuration} min</p>
                    </div>
                  </div>
                )}
              </div>

              <Button type="button" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold mt-4" onClick={() => setStep(2)} disabled={!formData.branchId || !formData.serviceId}>
                {t("continue")}
              </Button>
              {!user && (
                <div className="space-y-2">
                  <Link href="/check">
                    <Button type="button" className="w-full bg-amber-600 hover:bg-amber-700 text-white">{t("checkByNumber")}</Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200"><UserIcon className="w-4 h-4" /> {t("barber")}</Label>
                <Select value={effectiveBarberId} onValueChange={(v) => updateForm("barberId", v)}>
                  <SelectTrigger className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                    <SelectValue placeholder={isLoadingBarbers ? t("loading") : t("selectBarber")} />
                  </SelectTrigger>
                  <SelectContent>
                    {barbersForBranch?.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id.toString()}>
                        <div className="flex items-center gap-2">
                          <img
                            src={barber.photoUrl || "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&q=80"}
                            alt={`${barber.firstName} ${barber.lastName}`}
                            className="h-12 w-12 rounded-md object-cover border border-zinc-300"
                          />
                          <span>{barber.firstName} {barber.lastName} ({barber.yearsOfExperience ?? 0} {t("expShort")})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBarber && (
                  <p className="text-xs text-zinc-500">{t("reserveWith")}: {selectedBarber.firstName} {selectedBarber.lastName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200"><CalendarIcon className="w-4 h-4" /> {t("date")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100",
                          !formData.appointmentDate && "text-muted-foreground",
                        )}
                      >
                        {formData.appointmentDate ? format(formData.appointmentDate, "PPP") : <span>{t("pickDate")}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700" align="start">
                      <Calendar mode="single" selected={formData.appointmentDate} onSelect={(date) => date && updateForm("appointmentDate", date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200"><Clock className="w-4 h-4" /> {t("time")}</Label>
                  <Select value={formData.timeSlot} onValueChange={(v) => updateForm("timeSlot", v)}>
                    <SelectTrigger className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      <SelectValue placeholder={t("selectTime")} />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time} disabled={blockedSlotSet.has(time)}>
                          <div className="flex items-center justify-between w-full gap-3">
                            <span>{time}</span>
                            {blockedSlotSet.has(time) && <CircleAlert className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.timeSlot && blockedSlotSet.has(formData.timeSlot) && (
                    <p className="text-xs text-red-600">{t("barberUnavailableAt")} {formData.timeSlot}.</p>
                  )}
                  {selectedService && (
                    <p className="text-xs text-zinc-500">{t("barberLockedMinutes")} {minimumBarberLockMinutes} {t("minutesPerBooking")}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="w-full border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setStep(1)}>
                  {t("back")}
                </Button>
                <Button type="button" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold" onClick={() => setStep(3)} disabled={!effectiveBarberId || !formData.timeSlot || blockedSlotSet.has(formData.timeSlot)}>
                  {t("continue")}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {user ? (
                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60">
                  <p className="text-zinc-700 dark:text-zinc-200 font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> {t("priorityEnabled")}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-1">{t("loyaltyEarn")}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("firstName")}</Label>
                      <Input className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100" value={formData.guestFirstName} onChange={(e) => updateForm("guestFirstName", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("lastName")}</Label>
                      <Input className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100" value={formData.guestLastName} onChange={(e) => updateForm("guestLastName", e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("phoneNumber")}</Label>
                    <Input className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100" type="tel" value={formData.guestPhone} onChange={(e) => updateForm("guestPhone", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailOptional")}</Label>
                    <Input className="bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100" type="email" value={formData.guestEmail} onChange={(e) => updateForm("guestEmail", e.target.value)} required />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-200">Payment option</Label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => updateForm("paymentMethod", "cash_on_arrival")}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                       formData.paymentMethod === "cash_on_arrival" ? "border-zinc-900 bg-zinc-100 dark:bg-zinc-800" : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                    )}
                  >
                     <div className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-100">
                      <Wallet className="w-4 h-4" />
                      Pay at salon
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">No prepayment. Pay on arrival.</p>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                 <Button type="button" variant="outline" className="w-full border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => setStep(2)}>
                  {t("back")}
                </Button>
                <Button
                  type="submit"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
                  disabled={createAppointment.isPending || (!user && (!formData.guestFirstName || !formData.guestLastName || !formData.guestPhone))}
                >
                  {createAppointment.isPending ? t("submitting") : t("submitReservation")}
                </Button>
              </div>

              {user && formData.serviceId && formData.appointmentDate && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const res = await fetch(api.waitlist.join.path, {
                        method: api.waitlist.join.method,
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          serviceId: Number(formData.serviceId),
                          date: new Date(formData.appointmentDate).toISOString(),
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.message || "Failed to join waitlist");
                      toast({ title: "Added to waitlist" });
                    } catch (error: any) {
                      toast({ variant: "destructive", title: "Waitlist", description: error.message });
                    }
                  }}
                >
                  Join Waitlist if slots are full
                </Button>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
