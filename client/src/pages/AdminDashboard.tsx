import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Users, CalendarDays, Scissors, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments } from "@/hooks/use-appointments";
import { useBarbers, useCreateBarber } from "@/hooks/use-barbers";
import { useServices, useCreateService } from "@/hooks/use-services";
import { useBranches } from "@/hooks/use-branches";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  const { data: appointments } = useAppointments();
  const { data: barbers } = useBarbers();
  const { data: services } = useServices();
  const { data: branches } = useBranches();
  
  const createService = useCreateService();
  const createBarber = useCreateBarber();

  const [newService, setNewService] = useState({ name: "", price: "", durationMinutes: "" });
  const [newBarber, setNewBarber] = useState({ username: "", password: "", firstName: "", lastName: "", role: "barber" });

  if (user?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Admin only.</div>;
  }

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createService.mutateAsync({
        name: newService.name,
        price: parseInt(newService.price),
        durationMinutes: parseInt(newService.durationMinutes)
      });
      toast({ title: "Service Created" });
      setNewService({ name: "", price: "", durationMinutes: "" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleCreateBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBarber.mutateAsync(newBarber);
      toast({ title: "Barber Account Created" });
      setNewBarber({ username: "", password: "", firstName: "", lastName: "", role: "barber" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col">
        <h2 className="text-2xl font-display font-bold text-amber-500 mb-8">Admin Panel</h2>
        <nav className="space-y-2 flex-1">
          <p className="text-sm font-medium text-zinc-500 px-4 mb-2 uppercase tracking-wider">Menu</p>
          <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800">
            <CalendarDays className="mr-3 h-5 w-5" /> Appointments
          </Button>
          <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800">
            <Users className="mr-3 h-5 w-5" /> Barbers
          </Button>
          <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800">
            <Scissors className="mr-3 h-5 w-5" /> Services
          </Button>
        </nav>
        <div className="mt-auto pt-6 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold">
              {user.firstName[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-zinc-500">Administrator</p>
            </div>
          </div>
          <Button variant="destructive" className="w-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none" onClick={() => { logout(); setLocation("/"); }}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-display font-bold text-white mb-8">Dashboard Overview</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2"><CardTitle className="text-zinc-400 text-sm font-medium">Total Appointments</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-amber-500">{appointments?.length || 0}</p></CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2"><CardTitle className="text-zinc-400 text-sm font-medium">Active Barbers</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-white">{barbers?.filter(b => b.role === 'barber').length || 0}</p></CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2"><CardTitle className="text-zinc-400 text-sm font-medium">Total Services</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-white">{services?.length || 0}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
            <TabsTrigger value="appointments" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">Appointments</TabsTrigger>
            <TabsTrigger value="barbers" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">Barbers</TabsTrigger>
            <TabsTrigger value="services" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">Services</TabsTrigger>
          </TabsList>
          
          <TabsContent value="appointments" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4">All Appointments</h3>
            <Table>
              <TableHeader className="border-zinc-800">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-zinc-400">Date/Time</TableHead>
                  <TableHead className="text-zinc-400">Client</TableHead>
                  <TableHead className="text-zinc-400">Barber ID</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments?.map(apt => (
                  <TableRow key={apt.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="font-medium">{format(new Date(apt.appointmentDate), "MMM do, HH:mm")}</TableCell>
                    <TableCell>{apt.guestFirstName || 'Registered Client'}</TableCell>
                    <TableCell>#{apt.barberId}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        apt.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                        apt.status === 'accepted' ? 'bg-green-500/20 text-green-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {apt.status.toUpperCase()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="barbers" className="space-y-6">
            <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold">Manage Barbers</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold"><Plus className="w-4 h-4 mr-2"/> Add Barber</Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Create Barber Account</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateBarber} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>First Name</Label><Input className="bg-zinc-950 border-zinc-800" value={newBarber.firstName} onChange={e => setNewBarber({...newBarber, firstName: e.target.value})} required/></div>
                      <div className="space-y-2"><Label>Last Name</Label><Input className="bg-zinc-950 border-zinc-800" value={newBarber.lastName} onChange={e => setNewBarber({...newBarber, lastName: e.target.value})} required/></div>
                    </div>
                    <div className="space-y-2"><Label>Username</Label><Input className="bg-zinc-950 border-zinc-800" value={newBarber.username} onChange={e => setNewBarber({...newBarber, username: e.target.value})} required/></div>
                    <div className="space-y-2"><Label>Password</Label><Input className="bg-zinc-950 border-zinc-800" type="password" value={newBarber.password} onChange={e => setNewBarber({...newBarber, password: e.target.value})} required/></div>
                    <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black" disabled={createBarber.isPending}>Create</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {barbers?.filter(b => b.role === 'barber').map(barber => (
                <Card key={barber.id} className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle>{barber.firstName} {barber.lastName}</CardTitle>
                    <p className="text-zinc-500 text-sm">@{barber.username}</p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-bold">Manage Services</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold"><Plus className="w-4 h-4 mr-2"/> Add Service</Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Add New Service</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateService} className="space-y-4 pt-4">
                    <div className="space-y-2"><Label>Service Name</Label><Input className="bg-zinc-950 border-zinc-800" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} required/></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Price ($)</Label><Input className="bg-zinc-950 border-zinc-800" type="number" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} required/></div>
                      <div className="space-y-2"><Label>Duration (mins)</Label><Input className="bg-zinc-950 border-zinc-800" type="number" value={newService.durationMinutes} onChange={e => setNewService({...newService, durationMinutes: e.target.value})} required/></div>
                    </div>
                    <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black" disabled={createService.isPending}>Save Service</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {services?.map(service => (
                <Card key={service.id} className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-amber-500">{service.name}</CardTitle>
                    <p className="text-white text-2xl font-bold">${service.price}</p>
                    <p className="text-zinc-500 text-sm flex items-center gap-1"><Clock className="w-3 h-3"/> {service.durationMinutes} mins</p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
