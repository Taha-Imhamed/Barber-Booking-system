import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AppointmentType, UserType } from "@shared/routes";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

type Props = {
  appointments: AppointmentType[];
  barbers: UserType[];
  allowDrag?: boolean;
};

export default function AppointmentCalendar({ appointments, barbers, allowDrag = false }: Props) {
  const { toast } = useToast();
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [selected, setSelected] = useState<AppointmentType | null>(null);

  const events = useMemo(() => {
    return appointments
      .filter((a) => barberFilter === "all" || String(a.barberId) === barberFilter)
      .map((a) => ({
        id: String(a.id),
        title: `#${a.id} ${a.status}`,
        start: a.appointmentDate,
        backgroundColor:
          a.status === "accepted"
            ? "#15803d"
            : a.status === "rejected"
              ? "#b91c1c"
              : a.status === "completed"
                ? "#1d4ed8"
                : "#d97706",
        borderColor: "transparent",
      }));
  }, [appointments, barberFilter]);

  const handleDrop = async (eventId: string, nextDate: Date | null) => {
    if (!allowDrag || !nextDate) return;
    const id = Number(eventId);
    const url = buildUrl(api.calendar.moveAppointment.path, { id });
    const res = await fetch(url, {
      method: api.calendar.moveAppointment.method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ appointmentDate: nextDate.toISOString() }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Move failed", description: payload?.message ?? "Could not move appointment." });
      return;
    }
    toast({ title: "Appointment moved" });
  };

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select value={barberFilter} onValueChange={setBarberFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter barber" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All barbers</SelectItem>
            {barbers.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.firstName} {b.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-white p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek" }}
          editable={allowDrag}
          eventDrop={(info) => {
            void handleDrop(info.event.id, info.event.start);
          }}
          eventClick={(info) => {
            const apt = appointments.find((a) => String(a.id) === info.event.id) ?? null;
            setSelected(apt);
          }}
          events={events}
          height={720}
        />
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-2 text-sm">
              <p>ID: {selected.id}</p>
              <p>Date: {new Date(selected.appointmentDate).toLocaleString()}</p>
              <p>Barber ID: {selected.barberId}</p>
              <p>Service ID: {selected.serviceId}</p>
              <Badge>{selected.status}</Badge>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
