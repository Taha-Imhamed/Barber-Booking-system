import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Scissors, User as UserIcon, Clock } from "lucide-react";
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

export function ReservationForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: branches, isLoading: isLoadingBranches } = useBranches();
  const { data: services, isLoading: isLoadingServices } = useServices();
  const { data: barbers, isLoading: isLoadingBarbers } = useBarbers();
  const createAppointment = useCreateAppointment();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
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

  const updateForm = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Combine date and time
      const [hours, minutes] = formData.timeSlot.split(':');
      const finalDate = new Date(formData.appointmentDate);
      finalDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const payload: any = {
        branchId: parseInt(formData.branchId),
        serviceId: parseInt(formData.serviceId),
        barberId: parseInt(formData.barberId),
        appointmentDate: finalDate.toISOString(),
        status: "pending",
      };

      if (user) {
        payload.clientId = user.id;
      } else {
        payload.guestFirstName = formData.guestFirstName;
        payload.guestLastName = formData.guestLastName;
        payload.guestPhone = formData.guestPhone;
        payload.guestEmail = formData.guestEmail;
      }

      await createAppointment.mutateAsync(payload);
      
      toast({
        title: "Appointment Requested!",
        description: "Your request has been sent to the barber. We will notify you once accepted.",
      });
      
      // Reset form
      setStep(1);
      setFormData({
        ...formData,
        branchId: "",
        serviceId: "",
        barberId: "",
        timeSlot: "",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create appointment.",
      });
    }
  };

  const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

  return (
    <Card className="glass-panel border-zinc-800 text-zinc-100 w-full max-w-lg mx-auto overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
        <div 
          className="h-full bg-amber-500 transition-all duration-500 ease-out" 
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
      
      <CardHeader className="pt-8">
        <CardTitle className="text-3xl font-display text-center text-amber-500">Reserve a Seat</CardTitle>
        <CardDescription className="text-center text-zinc-400">
          Step {step} of 3
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1: Branch & Service */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-500"/> Select Branch</Label>
                <Select value={formData.branchId} onValueChange={(v) => updateForm("branchId", v)}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700">
                    <SelectValue placeholder={isLoadingBranches ? "Loading..." : "Choose a branch..."} />
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
                <Label className="flex items-center gap-2"><Scissors className="w-4 h-4 text-amber-500"/> Select Service</Label>
                <Select value={formData.serviceId} onValueChange={(v) => updateForm("serviceId", v)}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700">
                    <SelectValue placeholder={isLoadingServices ? "Loading..." : "Choose a service..."} />
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
              
              <Button 
                type="button" 
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold mt-4"
                onClick={handleNext}
                disabled={!formData.branchId || !formData.serviceId}
              >
                Next Step
              </Button>
            </div>
          )}

          {/* STEP 2: Barber & Date */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><UserIcon className="w-4 h-4 text-amber-500"/> Select Barber</Label>
                <Select value={formData.barberId} onValueChange={(v) => updateForm("barberId", v)}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700">
                    <SelectValue placeholder={isLoadingBarbers ? "Loading..." : "Choose a barber..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {barbers?.filter(b => b.role === 'barber').map((barber) => (
                      <SelectItem key={barber.id} value={barber.id.toString()}>
                        {barber.firstName} {barber.lastName} ({barber.yearsOfExperience}y exp)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-amber-500"/> Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal bg-zinc-900 border-zinc-700",
                          !formData.appointmentDate && "text-muted-foreground"
                        )}
                      >
                        {formData.appointmentDate ? format(formData.appointmentDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 text-zinc-100" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.appointmentDate}
                        onSelect={(date) => updateForm("appointmentDate", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500"/> Time</Label>
                  <Select value={formData.timeSlot} onValueChange={(v) => updateForm("timeSlot", v)}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700">
                      <SelectValue placeholder="Time..." />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <Button type="button" variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800" onClick={handleBack}>
                  Back
                </Button>
                <Button 
                  type="button" 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
                  onClick={handleNext}
                  disabled={!formData.barberId || !formData.appointmentDate || !formData.timeSlot}
                >
                  Next Step
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Details & Confirm */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {user ? (
                <div className="p-4 bg-zinc-900 rounded-lg border border-amber-500/20 text-center">
                  <p className="text-zinc-300">Booking as <span className="text-amber-500 font-semibold">{user.firstName} {user.lastName}</span></p>
                  <p className="text-sm text-zinc-500 mt-1">You will earn loyalty points for this visit!</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input className="bg-zinc-900 border-zinc-700 focus:border-amber-500" value={formData.guestFirstName} onChange={(e) => updateForm("guestFirstName", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input className="bg-zinc-900 border-zinc-700 focus:border-amber-500" value={formData.guestLastName} onChange={(e) => updateForm("guestLastName", e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input className="bg-zinc-900 border-zinc-700 focus:border-amber-500" type="tel" value={formData.guestPhone} onChange={(e) => updateForm("guestPhone", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (Optional)</Label>
                    <Input className="bg-zinc-900 border-zinc-700 focus:border-amber-500" type="email" value={formData.guestEmail} onChange={(e) => updateForm("guestEmail", e.target.value)} />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800" onClick={handleBack}>
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all"
                  disabled={createAppointment.isPending || (!user && (!formData.guestFirstName || !formData.guestLastName || !formData.guestPhone))}
                >
                  {createAppointment.isPending ? "Confirming..." : "Confirm Appointment"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
