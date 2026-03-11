import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { CalendarDays, CheckCircle, XCircle, Clock3, LogOut, BarChart3, TableProperties, Moon, Sun, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments, useUpdateAppointmentStatus } from "@/hooks/use-appointments";
import { useServices } from "@/hooks/use-services";
import { useToast } from "@/hooks/use-toast";
import { playNotificationTone } from "@/lib/playNotificationTone";
import { useUpdateBarber } from "@/hooks/use-barbers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@shared/routes";
import { usePublicSettings } from "@/hooks/use-settings";
import { useTheme } from "@/hooks/use-theme";
import { useI18n } from "@/i18n";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import { useAddGalleryItem, useBarberGallery, useDeleteGalleryItem, useUpdateGalleryItem } from "@/hooks/use-advanced";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeInstagramUrl } from "@/lib/instagram";

export default function BarberDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const barberUser = user?.role === "barber" ? user : null;
  const { toast } = useToast();
  const { t } = useI18n();
  const { themeMode, toggleTheme } = useTheme();

  const { data: allAppointments } = useAppointments();
  const { data: services } = useServices();
  const updateStatus = useUpdateAppointmentStatus();
  const updateBarber = useUpdateBarber();
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<"pending" | "upcoming" | "accepted" | "timetable" | "chat" | "gallery">("pending");
  const [showTimetable, setShowTimetable] = useState<boolean>(() => localStorage.getItem("barber_show_timetable") !== "0");
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [groupMessageText, setGroupMessageText] = useState("");
  const [clientHistory, setClientHistory] = useState<any | null>(null);
  const [tipByAppointment, setTipByAppointment] = useState<Record<number, string>>({});
  const { data: settings } = usePublicSettings();
  const gallery = useBarberGallery(barberUser?.id);
  const addGalleryItem = useAddGalleryItem();
  const updateGalleryItem = useUpdateGalleryItem();
  const deleteGalleryItem = useDeleteGalleryItem();
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [editingGalleryId, setEditingGalleryId] = useState<number | null>(null);
  const [captionDraftById, setCaptionDraftById] = useState<Record<number, string>>({});
  const [replaceFileById, setReplaceFileById] = useState<Record<number, File | null>>({});
  const [isAvailable, setIsAvailable] = useState<boolean>(barberUser?.isAvailable !== false);
  const [instagramUrl, setInstagramUrl] = useState<string>(barberUser?.instagramUrl ?? "");
  const [unavailableHours, setUnavailableHours] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(barberUser?.unavailableHours ?? "[]");
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  });

  const previousPendingCount = useRef(0);

  const myAppointments = allAppointments?.filter((a) => Number(a.barberId) === Number(barberUser?.id ?? -1)) || [];
  const pending = [...myAppointments].filter((a) => a.status === "pending").sort((a, b) => Number(!!b.clientId) - Number(!!a.clientId));
  const accepted = myAppointments.filter((a) => a.status === "accepted");
  const completed = myAppointments.filter((a) => a.status === "completed");
  const schedule = [...myAppointments].sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());
  const galleryItems = useMemo(
    () =>
      (gallery.data ?? []).map((img: any) => ({
        id: Number(img.id),
        imageUrl: String(img.image_url ?? img.imageUrl ?? ""),
        caption: String(img.caption ?? ""),
      })),
    [gallery.data],
  );

  const upcomingAppointments = useMemo(
    () =>
      myAppointments
        .filter((a) => ["pending", "accepted"].includes(a.status) && new Date(a.appointmentDate).getTime() >= Date.now())
        .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()),
    [myAppointments],
  );

  useEffect(() => {
    if (pending.length > previousPendingCount.current) {
      playNotificationTone(settings?.notificationSound ?? "chime");
    }
    previousPendingCount.current = pending.length;
  }, [pending.length, settings?.notificationSound]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!barberUser) return;
    setIsAvailable(barberUser.isAvailable !== false);
    try {
      const parsed = JSON.parse(barberUser.unavailableHours ?? "[]");
      setUnavailableHours(Array.isArray(parsed) ? parsed.map((v) => String(v)) : []);
    } catch {
      setUnavailableHours([]);
    }
    setInstagramUrl(barberUser.instagramUrl ?? "");
  }, [barberUser?.id, barberUser?.isAvailable, barberUser?.unavailableHours, barberUser?.instagramUrl]);

  const handleStatusChange = async (id: number, status: string, options?: { proposedDate?: string; tipAmount?: number }) => {
    try {
      await updateStatus.mutateAsync({ id, status, ...options });
      toast({ title: `Appointment ${status}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!barberUser) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const max = 600;
          const ratio = Math.min(1, max / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          await updateBarber.mutateAsync({ id: barberUser.id, data: { photoUrl: compressed } });
          toast({ title: "Profile photo updated" });
        };
        img.src = String(reader.result ?? "");
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error", description: err.message || "Failed to upload photo." });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvailability = async () => {
    if (!barberUser) return;
    try {
      await updateBarber.mutateAsync({
        id: barberUser.id,
        data: {
          isAvailable,
          unavailableHours: JSON.stringify(unavailableHours.sort()),
        },
      });
      toast({ title: "Availability updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to save availability." });
    }
  };

  const handleSaveInstagram = async () => {
    if (!barberUser) return;
    try {
      const normalized = normalizeInstagramUrl(instagramUrl);
      await updateBarber.mutateAsync({
        id: barberUser.id,
        data: { instagramUrl: normalized ?? null },
      });
      toast({ title: "Instagram link updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to save Instagram link." });
    }
  };

  const toggleHour = (hour: string) => {
    setUnavailableHours((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]));
  };

  const compressImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const max = 1200;
            const ratio = Math.min(1, max / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas is not supported."));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
            resolve(dataUrl);
          } catch (e: any) {
            reject(new Error(e?.message || "Image compression failed."));
          }
        };
        img.onerror = () => reject(new Error("Invalid image file."));
        img.src = String(reader.result ?? "");
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });

  const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const handleSaveGalleryItem = async () => {
    if (!galleryFile || !barberUser) {
      toast({ variant: "destructive", title: "Select an image first" });
      return;
    }
    try {
      const compressed = await compressImageFile(galleryFile);
      await addGalleryItem.mutateAsync({
        barberId: barberUser.id,
        imageUrl: compressed,
        caption: galleryCaption || undefined,
      });
      setGalleryCaption("");
      setGalleryFile(null);
      toast({ title: "Gallery image saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message || "Could not upload image." });
    }
  };
  const handleStartEditGallery = (item: any) => {
    setEditingGalleryId(Number(item.id));
    setCaptionDraftById((prev) => ({ ...prev, [item.id]: item.caption || "" }));
    setReplaceFileById((prev) => ({ ...prev, [item.id]: null }));
  };
  const handleCancelEditGallery = () => {
    setEditingGalleryId(null);
  };
  const handleUpdateGalleryItem = async (id: number) => {
    if (!barberUser) return;
    try {
      const replacementFile = replaceFileById[id];
      const imageUrl = replacementFile ? await compressImageFile(replacementFile) : undefined;
      await updateGalleryItem.mutateAsync({
        id,
        barberId: barberUser.id,
        imageUrl,
        caption: captionDraftById[id] ?? "",
      });
      setEditingGalleryId(null);
      setReplaceFileById((prev) => ({ ...prev, [id]: null }));
      toast({ title: "Gallery post updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message || "Could not update gallery post." });
    }
  };
  const handleDeleteGalleryItem = async (id: number) => {
    if (!barberUser) return;
    if (!window.confirm("Delete this gallery post?")) return;
    try {
      await deleteGalleryItem.mutateAsync({ id, barberId: barberUser.id });
      toast({ title: "Gallery post deleted" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message || "Could not delete gallery post." });
    }
  };

  const getServiceName = (id: number) => services?.find((s) => s.id === id)?.name || "Service";
  const statusChipClass = (status: string) => {
    if (status === "accepted") return "status-chip status-chip--accepted";
    if (status === "rejected") return "status-chip status-chip--rejected";
    if (status === "completed") return "status-chip status-chip--completed";
    if (status === "postponed") return "status-chip status-chip--postponed";
    return "status-chip status-chip--pending";
  };

  const loadGroups = async () => {
    const res = await fetch(api.chat.groups.path, { credentials: "include" });
    if (res.ok) setGroups(await res.json());
  };

  const loadMessages = async (groupId: number) => {
    const res = await fetch(api.chat.messages.path.replace(":id", String(groupId)), { credentials: "include" });
    if (res.ok) setGroupMessages(await res.json());
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading dashboard...</div>;
  if (!barberUser) return <div className="p-8 text-center text-red-500">Access denied. Barber only.</div>;

  return (
    <div className="barber-theme min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-72 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 p-6 flex flex-col">
        <div className="mb-8 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Barber Portal</h2>
          <Button type="button" variant="outline" size="icon" title={`Theme: ${themeMode}`} onClick={toggleTheme}>
            {themeMode === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="space-y-2 mb-6">
          <Button variant={view === "pending" ? "default" : "outline"} className="w-full justify-start" onClick={() => setView("pending")}>Pending</Button>
          <Button variant={view === "upcoming" ? "default" : "outline"} className="w-full justify-start" onClick={() => setView("upcoming")}>Upcoming</Button>
          <Button variant={view === "accepted" ? "default" : "outline"} className="w-full justify-start" onClick={() => setView("accepted")}>Accepted</Button>
          <Button variant={view === "timetable" ? "default" : "outline"} className="w-full justify-start" onClick={() => setView("timetable")}>Full Timetable</Button>
          <Button variant={view === "gallery" ? "default" : "outline"} className="w-full justify-start" onClick={() => setView("gallery")}>Gallery</Button>
          <Button variant={view === "chat" ? "default" : "outline"} className="w-full justify-start" onClick={() => { setView("chat"); void loadGroups(); }}>Group Chat</Button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full border border-slate-300 flex items-center justify-center bg-slate-50 font-semibold">
              {barberUser.firstName[0]}{barberUser.lastName[0]}
            </div>
            <div>
              <p className="text-sm font-semibold">{barberUser.firstName} {barberUser.lastName}</p>
              <p className="text-xs text-slate-500">Barber</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mb-2"
            onClick={() => setLocation("/")}
          >
            <Home className="mr-2 h-4 w-4" /> Back To Home
          </Button>
          <Button
            variant="destructive"
            className="w-full bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border-none"
            onClick={() => {
              logout();
              setLocation("/");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {view === "chat" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4 space-y-2">
              <h3 className="font-semibold">My Groups</h3>
              {groups.map((g) => (
                <Button key={g.id} variant={activeGroupId === g.id ? "default" : "outline"} className="w-full justify-start" onClick={() => { setActiveGroupId(g.id); void loadMessages(g.id); }}>
                  {g.name}
                </Button>
              ))}
            </div>
            <div className="md:col-span-2 bg-white border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold">Messages</h3>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {groupMessages.map((m) => (
                  <div key={m.id} className={`border rounded p-2 text-sm ${m.senderRole === "admin" ? "bg-sky-50 border-sky-300" : "bg-white"}`}>
                    <p><strong>{m.senderRole === "admin" ? "* " : ""}{m.senderName || `User #${m.userId}`}:</strong> {m.content}</p>
                  </div>
                ))}
              </div>
              {activeGroupId && (
                <div className="flex gap-2">
                  <Input value={groupMessageText} onChange={(e) => setGroupMessageText(e.target.value)} placeholder="Write..." />
                  <Button onClick={async () => {
                    const res = await fetch(api.chat.sendMessage.path.replace(":id", String(activeGroupId)), {
                      method: api.chat.sendMessage.method,
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ content: groupMessageText }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      if (res.status === 403) {
                        setActiveGroupId(null);
                        await loadGroups();
                      }
                      return toast({ variant: "destructive", title: "Send failed", description: data.message });
                    }
                    setGroupMessageText("");
                    void loadMessages(activeGroupId);
                  }}>Send</Button>
                </div>
              )}
            </div>
          </div>
        ) : (
        <>
        <div className="mb-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = !showTimetable;
                setShowTimetable(next);
                localStorage.setItem("barber_show_timetable", next ? "1" : "0");
              }}
            >
              {showTimetable ? "Hide Timetable" : "Show Timetable"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => playNotificationTone(settings?.notificationSound ?? "chime")}>
              Test Sound
            </Button>
          </div>
        </div>
        <header className="mb-8 space-y-4">
          <h1 className="text-3xl font-semibold mb-2">Welcome back, {barberUser.firstName}</h1>
          <p className="text-slate-600">Monitor your queue and complete your timetable.</p>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <img
                src={barberUser.photoUrl || "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&q=80"}
                alt="Barber profile"
                className="w-20 h-20 rounded-full object-cover border border-slate-300"
              />
              <div>
                <p className="text-sm font-medium mb-1">Upload your photo from your device</p>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhotoUpload(file);
                  }}
                />
              </div>
            </div>
            <div className="mt-4 max-w-xl">
              <Label className="text-sm text-slate-700">Instagram link</Label>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <Input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/yourname or @yourname"
                />
                <Button type="button" onClick={handleSaveInstagram} disabled={updateBarber.isPending}>
                  {updateBarber.isPending ? "Saving..." : "Save Instagram"}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Clients can open this when they tap your photo.</p>
            </div>
          {view === "gallery" && (
          <div className="mt-4 rounded-xl border border-slate-200 p-4 bg-white">
            <p className="font-semibold mb-2">Portfolio / Gallery Posts</p>
            <div className="flex gap-2 mb-3">
              <Input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} placeholder="Caption (optional)" />
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setGalleryFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" onClick={handleSaveGalleryItem} disabled={!galleryFile || addGalleryItem.isPending}>
                {addGalleryItem.isPending ? "Saving..." : "Save to Gallery"}
              </Button>
            </div>
            {galleryFile ? <p className="text-xs text-slate-600 dark:text-zinc-300 mb-2">Selected file: {galleryFile.name}</p> : null}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {galleryItems.map((img) => (
                <div key={img.id} className="rounded-lg border border-slate-200 p-2 bg-slate-50 dark:bg-zinc-900/70 dark:border-zinc-700">
                  <img src={img.imageUrl} alt={img.caption || "Gallery"} className="h-32 w-full rounded object-cover border mb-2" />
                  {editingGalleryId === img.id ? (
                    <div className="space-y-2">
                      <Input
                        value={captionDraftById[img.id] ?? img.caption}
                        onChange={(e) => setCaptionDraftById((prev) => ({ ...prev, [img.id]: e.target.value }))}
                        placeholder="Edit caption"
                      />
                      <Input type="file" accept="image/*" onChange={(e) => setReplaceFileById((prev) => ({ ...prev, [img.id]: e.target.files?.[0] ?? null }))} />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleUpdateGalleryItem(img.id)}
                          disabled={updateGalleryItem.isPending}
                        >
                          {updateGalleryItem.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEditGallery}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700 dark:text-zinc-200 min-h-10">{img.caption || "No caption"}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleStartEditGallery(img)}>Edit</Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleDeleteGalleryItem(img.id)}
                          disabled={deleteGalleryItem.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {galleryItems.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-zinc-300">No gallery posts yet. Add a new post above.</p>
              ) : null}
            </div>
          </div>
          )}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="font-semibold">Availability</p>
              <Button variant={isAvailable ? "default" : "outline"} onClick={() => setIsAvailable((v) => !v)}>
                {isAvailable ? "Available ON" : "Available OFF"}
              </Button>
            </div>
            <p className="text-sm text-slate-600 mb-3">Select hours when you are NOT available:</p>
            <div className="flex flex-wrap gap-2">
              {timeSlots.map((slot) => (
                <Button
                  key={slot}
                  type="button"
                  size="sm"
                  variant={unavailableHours.includes(slot) ? "destructive" : "outline"}
                  onClick={() => toggleHour(slot)}
                >
                  {slot}
                </Button>
              ))}
            </div>
            <Button className="mt-4" onClick={handleSaveAvailability} disabled={updateBarber.isPending}>
              {updateBarber.isPending ? "Saving..." : "Save Availability"}
            </Button>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Pending Requests</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{pending.length}</p></CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Accepted</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{accepted.length}</p></CardContent>
          </Card>
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 flex items-center gap-1"><BarChart3 className="w-4 h-4" /> Completed</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{completed.length}</p></CardContent>
          </Card>
        </div>

        {view === "pending" && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-2xl font-semibold">Pending Requests</h2>
            <span className="bg-slate-900 text-white font-semibold px-3 py-1 rounded-full text-sm">{pending.length}</span>
          </div>

          {pending.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">No new requests.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pending.map((apt) => (
                <Card key={apt.id} className="bg-white border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">
                        {apt.guestFirstName || "Client"} {apt.guestLastName || ""}
                      </CardTitle>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${apt.clientId ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {apt.clientId ? "Priority" : "Guest"}
                      </span>
                    </div>
                    <p className="text-slate-600">{getServiceName(apt.serviceId)}</p>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <CalendarDays className="w-4 h-4" />
                      {format(new Date(apt.appointmentDate), "EEEE, MMM do")}
                    </div>
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-2xl mt-1">
                      <Clock3 className="w-5 h-5" />
                      {format(new Date(apt.appointmentDate), "HH:mm")}
                    </div>
                  </CardContent>
                  <CardFooter className="grid grid-cols-3 gap-2 pt-0">
                    <Button onClick={() => handleStatusChange(apt.id, "accepted")} className="bg-emerald-700 hover:bg-emerald-800 text-white w-full" disabled={updateStatus.isPending}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const input = window.prompt("Pick new date/time (YYYY-MM-DDTHH:mm)", format(new Date(apt.appointmentDate), "yyyy-MM-dd'T'HH:mm"));
                        if (!input) return;
                        const iso = new Date(input).toISOString();
                        void handleStatusChange(apt.id, "postponed", { proposedDate: iso });
                      }}
                      className="border-orange-500 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/40 w-full"
                      disabled={updateStatus.isPending}
                    >
                      Postpone
                    </Button>
                    <Button variant="outline" onClick={() => handleStatusChange(apt.id, "rejected")} className="border-rose-600 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 w-full" disabled={updateStatus.isPending}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
        )}

        {view === "upcoming" && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-5">Upcoming Appointments</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            {upcomingAppointments.length === 0 && <p className="text-slate-500">No upcoming appointments.</p>}
            {upcomingAppointments.map((apt) => {
              const ms = new Date(apt.appointmentDate).getTime() - now;
              const totalMin = Math.max(0, Math.floor(ms / 60000));
              const hours = Math.floor(totalMin / 60);
              const mins = totalMin % 60;
              return (
                <div key={`upcoming-${apt.id}`} className="border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-semibold">{apt.guestFirstName ? `${apt.guestFirstName} ${apt.guestLastName ?? ""}` : "Registered Client"}</p>
                    <p className="text-sm text-slate-500">{format(new Date(apt.appointmentDate), "PPP p")}</p>
                    <span className={statusChipClass(apt.status)}>{apt.status}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{hours}h {mins}m left</p>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {view === "accepted" && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-5">Accepted Appointments</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {accepted.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No accepted appointments yet.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {accepted.map((apt) => (
                  <div key={apt.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">
                        {apt.guestFirstName || "Client"} {apt.guestLastName || ""}
                      </p>
                      <p className="text-slate-600">{getServiceName(apt.serviceId)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-semibold">{format(new Date(apt.appointmentDate), "MMM do, HH:mm")}</p>
                      <Button
                        className="bg-slate-900 hover:bg-slate-800 text-white"
                        onClick={() => {
                          const tip = Number(tipByAppointment[apt.id] ?? "0");
                          void handleStatusChange(apt.id, "completed", { tipAmount: Number.isFinite(tip) ? Math.max(0, Math.floor(tip)) : 0 });
                          setTipByAppointment((prev) => ({ ...prev, [apt.id]: "" }));
                        }}
                      >
                        {t("completeWithTip")}
                      </Button>
                      <div className={`tip-panel ${Number(tipByAppointment[apt.id] ?? "0") > 0 ? "tip-panel--active" : ""}`}>
                        <label htmlFor={`tip-${apt.id}`} className="tip-panel__label">{t("addTipOptional")}</label>
                        <Input
                          id={`tip-${apt.id}`}
                          type="number"
                          min="0"
                          step="1"
                          value={tipByAppointment[apt.id] ?? ""}
                          onChange={(e) => setTipByAppointment((prev) => ({ ...prev, [apt.id]: e.target.value }))}
                          placeholder="0"
                          className="tip-panel__input"
                        />
                      </div>
                      {apt.clientId ? (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const res = await fetch(api.clientHistory.profile.path.replace(":id", String(apt.clientId)), { credentials: "include" });
                            if (!res.ok) return;
                            setClientHistory(await res.json());
                          }}
                        >
                          Client History
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {showTimetable && view === "timetable" && (
        <section>
          <AppointmentCalendar appointments={schedule} barbers={[barberUser]} />
          <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2"><TableProperties className="w-5 h-5" /> Full Timetable</h2>
          <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((apt) => (
                  <TableRow key={`sched-${apt.id}`}>
                    <TableCell>{format(new Date(apt.appointmentDate), "PPP p")}</TableCell>
                    <TableCell>{apt.guestFirstName ? `${apt.guestFirstName} ${apt.guestLastName ?? ""}` : "Registered Client"}</TableCell>
                    <TableCell>{getServiceName(apt.serviceId)}</TableCell>
                    <TableCell><span className={statusChipClass(apt.status)}>{apt.status}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
        )}
        </>
        )}
      </main>

      <Dialog open={Boolean(clientHistory)} onOpenChange={(open) => !open && setClientHistory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client History</DialogTitle>
          </DialogHeader>
          {clientHistory ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{clientHistory.client?.firstName} {clientHistory.client?.lastName}</p>
              <p>Favorite barber: {clientHistory.favoriteBarber ?? "-"}</p>
              <p>Most frequent service: {clientHistory.mostFrequentService ?? "-"}</p>
              <div className="max-h-56 overflow-auto space-y-1 border rounded p-2">
                {(clientHistory.visits ?? []).map((v: any) => (
                  <p key={v.id}>{new Date(v.date).toLocaleDateString()} - {v.service}</p>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}


