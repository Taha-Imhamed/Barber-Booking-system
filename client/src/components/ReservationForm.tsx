import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Scissors, User as UserIcon, Clock, ShieldCheck } from "lucide-react";
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
import { useCreateAppointment } from "@/hooks/use-appointments";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export function ReservationForm({ preselectedBarberId }: { preselectedBarberId?: number | null }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const { data: branches, isLoading: isLoadingBranches } = useBranches();
  const { data: services, isLoading: isLoadingServices } = useServices();
  const { data: barbers, isLoading: isLoadingBarbers } = useBarbers();
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
  });

  const updateForm = (key: keyof typeof formData, value: string | Date) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
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
        throw new Error("Please choose branch, service, barber, and time.");
      }
      if (user && !Number.isFinite(parsedClientId)) {
        throw new Error("Invalid account session. Please sign in again.");
      }

      const payload: Record<string, unknown> = {
        branchId: parsedBranchId,
        serviceId: parsedServiceId,
        barberId: parsedBarberId,
        appointmentDate: finalDate.toISOString(),
        status: "pending",
      };

      if (user) {
        payload.clientId = parsedClientId;
      } else {
        payload.guestFirstName = formData.guestFirstName;
        payload.guestLastName = formData.guestLastName;
        payload.guestPhone = formData.guestPhone;
        payload.guestEmail = formData.guestEmail || null;
      }

      await createAppointment.mutateAsync(payload);
      toast({
        title: "Reservation submitted",
        description: "Your request was sent to the barber. You will get notified on updates.",
      });

      setStep(1);
      setFormData({
        ...formData,
        branchId: "",
        serviceId: "",
        barberId: "",
        timeSlot: "",
        guestFirstName: "",
        guestLastName: "",
        guestPhone: "",
        guestEmail: "",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not submit reservation",
        description: error.message || "Try again.",
      });
    }
  };

  const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const barbersForBranch = barbers?.filter((b) => {
    if (b.role !== "barber") return false;
    if (b.isAvailable === false) return false;
    if (formData.branchId && b.branchId !== Number(formData.branchId)) return false;
    return true;
  });
  const selectedBarber = barbers?.find((b) => Number(b.id) === Number(preselectedBarberId));

  const effectiveBarberId = preselectedBarberId ? String(preselectedBarberId) : formData.barberId;
  const selectedBarberByChoice = barbers?.find((b) => Number(b.id) === Number(effectiveBarberId));
  const blockedHours = (() => {
    if (!selectedBarberByChoice?.unavailableHours) return [];
    try {
      const parsed = JSON.parse(selectedBarberByChoice.unavailableHours);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  })();

  return (
    <Card className="glass-panel text-zinc-900 w-full max-w-xl mx-auto overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-200">
        <div className="h-full bg-zinc-900 transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <CardHeader className="pt-7">
        <CardTitle className="text-3xl text-center">Book Your Appointment</CardTitle>
        <CardDescription className="text-center text-zinc-500">Step {step} of 3</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-zinc-700"><MapPin className="w-4 h-4" /> Branch</Label>
                <Select value={formData.branchId} onValueChange={(v) => updateForm("branchId", v)}>
                  <SelectTrigger className="bg-white border-zinc-300">
                    <SelectValue placeholder={isLoadingBranches ? "Loading..." : "Select branch"} />
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
                <Label className="flex items-center gap-2 text-zinc-700"><Scissors className="w-4 h-4" /> Service</Label>
                <Select value={formData.serviceId} onValueChange={(v) => updateForm("serviceId", v)}>
                  <SelectTrigger className="bg-white border-zinc-300">
                    <SelectValue placeholder={isLoadingServices ? "Loading..." : "Select service"} />
                  </SelectTrigger>
                  <SelectContent>
                    {services?.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name} - ${service.price} ({service.durationMinutes}m)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="button" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold mt-4" onClick={() => setStep(2)} disabled={!formData.branchId || !formData.serviceId}>
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-zinc-700"><UserIcon className="w-4 h-4" /> Barber</Label>
                <Select value={effectiveBarberId} onValueChange={(v) => updateForm("barberId", v)}>
                  <SelectTrigger className="bg-white border-zinc-300">
                    <SelectValue placeholder={isLoadingBarbers ? "Loading..." : "Select barber"} />
                  </SelectTrigger>
                  <SelectContent>
                    {barbersForBranch?.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id.toString()}>
                        {barber.firstName} {barber.lastName} ({barber.yearsOfExperience ?? 0}y exp)
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
                  <Label className="flex items-center gap-2 text-zinc-700"><CalendarIcon className="w-4 h-4" /> Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white border-zinc-300",
                          !formData.appointmentDate && "text-muted-foreground",
                        )}
                      >
                        {formData.appointmentDate ? format(formData.appointmentDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white border-zinc-200" align="start">
                      <Calendar mode="single" selected={formData.appointmentDate} onSelect={(date) => date && updateForm("appointmentDate", date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-zinc-700"><Clock className="w-4 h-4" /> Time</Label>
                  <Select value={formData.timeSlot} onValueChange={(v) => updateForm("timeSlot", v)}>
                    <SelectTrigger className="bg-white border-zinc-300">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time} disabled={blockedHours.includes(time)}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.timeSlot && blockedHours.includes(formData.timeSlot) && (
                    <p className="text-xs text-red-600">This barber is not available at {formData.timeSlot}.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="w-full border-zinc-300 hover:bg-zinc-100" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold" onClick={() => setStep(3)} disabled={!effectiveBarberId || !formData.timeSlot}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {user ? (
                <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                  <p className="text-zinc-700 font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Priority booking enabled for your account.</p>
                  <p className="text-sm text-zinc-500 mt-1">You earn loyalty points for completed visits and can redeem discounts later.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input className="bg-white border-zinc-300" value={formData.guestFirstName} onChange={(e) => updateForm("guestFirstName", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input className="bg-white border-zinc-300" value={formData.guestLastName} onChange={(e) => updateForm("guestLastName", e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input className="bg-white border-zinc-300" type="tel" value={formData.guestPhone} onChange={(e) => updateForm("guestPhone", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (Optional)</Label>
                    <Input className="bg-white border-zinc-300" type="email" value={formData.guestEmail} onChange={(e) => updateForm("guestEmail", e.target.value)} />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="w-full border-zinc-300 hover:bg-zinc-100" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  type="submit"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
                  disabled={createAppointment.isPending || (!user && (!formData.guestFirstName || !formData.guestLastName || !formData.guestPhone))}
                >
                  {createAppointment.isPending ? "Submitting..." : "Submit Reservation"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
