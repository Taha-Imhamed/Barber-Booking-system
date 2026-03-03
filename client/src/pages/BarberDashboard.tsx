import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { CalendarDays, CheckCircle, XCircle, Clock4, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments, useUpdateAppointmentStatus } from "@/hooks/use-appointments";
import { useServices } from "@/hooks/use-services";
import { useToast } from "@/hooks/use-toast";

export default function BarberDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  const { data: allAppointments } = useAppointments();
  const { data: services } = useServices();
  const updateStatus = useUpdateAppointmentStatus();

  if (user?.role !== 'barber') {
    return <div className="p-8 text-center text-red-500">Access Denied. Barbers only.</div>;
  }

  const myAppointments = allAppointments?.filter(a => a.barberId === user.id) || [];
  const pending = myAppointments.filter(a => a.status === 'pending');
  const upcoming = myAppointments.filter(a => a.status === 'accepted');

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({ title: `Appointment ${status}` });
      // In a real app, this mutation success would trigger a notification to the user via WebSockets/SSE
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const getServiceName = (id: number) => {
    return services?.find(s => s.id === id)?.name || "Service";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col">
        <h2 className="text-2xl font-display font-bold text-amber-500 mb-8">Barber Portal</h2>
        
        <div className="mt-auto pt-6 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.photoUrl || "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop"} className="w-12 h-12 rounded-full border border-amber-500" />
            <div>
              <p className="text-sm font-bold text-white">{user.firstName}</p>
              <p className="text-xs text-zinc-500">Master Barber</p>
            </div>
          </div>
          <Button variant="destructive" className="w-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none" onClick={() => { logout(); setLocation("/"); }}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-display font-bold text-white mb-2">Welcome back, {user.firstName}</h1>
          <p className="text-zinc-400">Here's your schedule and pending requests for today.</p>
        </header>

        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-amber-500">Pending Requests</h2>
              <span className="bg-amber-500 text-black font-bold px-3 py-1 rounded-full text-sm">{pending.length}</span>
            </div>
            
            {pending.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                No new requests at the moment.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pending.map(apt => (
                  <Card key={apt.id} className="bg-zinc-900 border-zinc-700 hover:border-amber-500/50 transition-colors shadow-lg">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl text-white">{apt.guestFirstName} {apt.guestLastName}</CardTitle>
                        <span className="text-xs font-mono bg-zinc-800 text-amber-500 px-2 py-1 rounded">New</span>
                      </div>
                      <p className="text-amber-500 font-medium">{getServiceName(apt.serviceId)}</p>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <CalendarDays className="w-4 h-4 text-zinc-500"/>
                        {format(new Date(apt.appointmentDate), "EEEE, MMM do")}
                      </div>
                      <div className="flex items-center gap-2 text-white font-bold text-2xl mt-2">
                        <Clock4 className="w-5 h-5 text-amber-500"/>
                        {format(new Date(apt.appointmentDate), "HH:mm")}
                      </div>
                    </CardContent>
                    <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                      <Button 
                        onClick={() => handleStatusChange(apt.id, 'accepted')}
                        className="bg-green-500 hover:bg-green-600 text-black font-bold w-full"
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2"/> Accept
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleStatusChange(apt.id, 'rejected')}
                        className="border-red-500/50 text-red-500 hover:bg-red-500/10 w-full"
                        disabled={updateStatus.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2"/> Reject
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Upcoming Appointments</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {upcoming.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">No accepted appointments yet.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {upcoming.map(apt => (
                    <div key={apt.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="text-center bg-zinc-950 px-4 py-3 rounded-lg border border-zinc-800">
                          <p className="text-xs text-amber-500 uppercase tracking-wider font-bold mb-1">{format(new Date(apt.appointmentDate), "MMM")}</p>
                          <p className="text-2xl font-display font-bold text-white leading-none">{format(new Date(apt.appointmentDate), "dd")}</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">{apt.guestFirstName} {apt.guestLastName}</p>
                          <p className="text-zinc-400">{getServiceName(apt.serviceId)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-mono text-amber-500 font-bold">{format(new Date(apt.appointmentDate), "HH:mm")}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                          onClick={() => handleStatusChange(apt.id, 'completed')}
                        >
                          Mark Done
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
