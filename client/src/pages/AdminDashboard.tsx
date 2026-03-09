import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { Plus, Users, CalendarDays, Scissors, LogOut, CheckCircle2, CircleX, Clock3, Pencil, Trash2, FileBarChart2, MessageSquareText, BarChart3, Moon, Sun, Home, Image as ImageIcon, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments, useUpdateAppointmentStatus } from "@/hooks/use-appointments";
import { useBarbers, useCreateBarber, useUpdateBarber, useDeleteBarber } from "@/hooks/use-barbers";
import { useServices, useCreateService, useUpdateService } from "@/hooks/use-services";
import { useBranches, useCreateBranch, useDeleteBranch } from "@/hooks/use-branches";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { AppointmentType, ExpenseType, ServiceType, UserType } from "@shared/routes";
import { Textarea } from "@/components/ui/textarea";
import { useSendAdminMessage } from "@/hooks/use-admin";
import { useEarningsSummary } from "@/hooks/use-earnings";
import { api, buildUrl } from "@shared/routes";
import { usePublicSettings, useSaveAdminSettings } from "@/hooks/use-settings";
import { useQueryClient } from "@tanstack/react-query";
import { playNotificationTone } from "@/lib/playNotificationTone";
import { useTheme } from "@/hooks/use-theme";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import AdminAdvancedModules from "@/components/AdminAdvancedModules";
import { useLandingMedia, useSaveLandingMedia } from "@/hooks/use-advanced";

type AdminTab =
  | "appointments"
  | "barbers"
  | "services"
  | "reports"
  | "timetable"
  | "finance"
  | "chat"
  | "wallDisplay"
  | "gallery"
  | "users"
  | "developer"
  | "growth";

type AdminThemeKey = "original" | "saasBlue" | "darkIndigo" | "blackGold" | "cleanModern" | "softModern";

const ADMIN_THEMES: Record<
  AdminThemeKey,
  {
    label: string;
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    text: string;
  }
> = {
  original: {
    label: "Original",
    primary: "#2563EB",
    secondary: "#1E40AF",
    accent: "#38BDF8",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#0F172A",
  },
  saasBlue: {
    label: "SaaS Blue",
    primary: "#2563EB",
    secondary: "#1E40AF",
    accent: "#38BDF8",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#0F172A",
  },
  darkIndigo: {
    label: "Dark Indigo",
    primary: "#6366F1",
    secondary: "#334155",
    accent: "#22C55E",
    background: "#0F172A",
    card: "#1E293B",
    text: "#F1F5F9",
  },
  blackGold: {
    label: "Black Gold",
    primary: "#111827",
    secondary: "#374151",
    accent: "#D4AF37",
    background: "#F9FAFB",
    card: "#FFFFFF",
    text: "#111827",
  },
  cleanModern: {
    label: "Clean Modern",
    primary: "#4F46E5",
    secondary: "#06B6D4",
    accent: "#22C55E",
    background: "#FFFFFF",
    card: "#F8FAFC",
    text: "#1F2937",
  },
  softModern: {
    label: "Soft Modern",
    primary: "#7C3AED",
    secondary: "#A78BFA",
    accent: "#F59E0B",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#111827",
  },
};
const ADMIN_THEME_ORDER: AdminThemeKey[] = ["original", "saasBlue", "darkIndigo", "blackGold", "cleanModern", "softModern"];

const ADMIN_MODULE_OPTIONS: { key: string; label: string }[] = [
  { key: "appointments", label: "Appointments" },
  { key: "barbers", label: "Barbers & Branches" },
  { key: "services", label: "Services" },
  { key: "reports", label: "Reports" },
  { key: "timetable", label: "Timetable" },
  { key: "finance", label: "Finance" },
  { key: "chat", label: "Group Chat" },
  { key: "wallDisplay", label: "Wall Display" },
  { key: "gallery", label: "Gallery" },
  { key: "users", label: "Users" },
  { key: "growth", label: "Growth & Ops" },
  { key: "developer", label: "Developer" },
  { key: "manage_admins", label: "Manage Admins" },
];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { toast } = useToast();
  const { themeMode, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: appointments } = useAppointments();
  const { data: barbers } = useBarbers();
  const { data: services } = useServices();
  const { data: branches } = useBranches();

  const createService = useCreateService();
  const updateService = useUpdateService();
  const createBarber = useCreateBarber();
  const updateBarber = useUpdateBarber();
  const deleteBarber = useDeleteBarber();
  const createBranch = useCreateBranch();
  const deleteBranch = useDeleteBranch();
  const updateStatus = useUpdateAppointmentStatus();
  const sendAdminMessage = useSendAdminMessage();
  const { data: earnings } = useEarningsSummary();
  const { data: settings } = usePublicSettings();
  const saveSettings = useSaveAdminSettings();
  const { data: landingMedia } = useLandingMedia();
  const saveLandingMedia = useSaveLandingMedia();

  const [activeTab, setActiveTab] = useState<AdminTab>("appointments");
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [editingBarber, setEditingBarber] = useState<UserType | null>(null);
  const [editingBarberPassword, setEditingBarberPassword] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [adminMessageText, setAdminMessageText] = useState("");
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseItems, setExpenseItems] = useState<ExpenseType[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingExpenseTitle, setEditingExpenseTitle] = useState("");
  const [editingExpenseAmount, setEditingExpenseAmount] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupMode, setGroupMode] = useState<"text_numbers" | "numbers_only">("text_numbers");
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [groupMessageText, setGroupMessageText] = useState("");
  const [groupTotals, setGroupTotals] = useState<{ groupTotal: number; byUser: { userId: number; total: number }[] } | null>(null);
  const [groupTotalsByGroup, setGroupTotalsByGroup] = useState<Record<number, number>>({});
  const [editingGroupMembers, setEditingGroupMembers] = useState<number[]>([]);
  const [wallBg, setWallBg] = useState("");
  const [soundChoice, setSoundChoice] = useState<"chime" | "beep" | "ding">("chime");
  const [wallShowWeather, setWallShowWeather] = useState(true);
  const [wallShowMusic, setWallShowMusic] = useState(true);
  const [wallQueueLimit, setWallQueueLimit] = useState("6");
  const [userViewType, setUserViewType] = useState<"all" | "barber" | "client">("all");
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersNote, setAdminUsersNote] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [developerSnapshot, setDeveloperSnapshot] = useState<any | null>(null);
  const [developerSchema, setDeveloperSchema] = useState<any | null>(null);
  const [developerSqlReport, setDeveloperSqlReport] = useState<any | null>(null);
  const [developerLoading, setDeveloperLoading] = useState(false);
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [developerSearch, setDeveloperSearch] = useState("");
  const [developerAutoRefresh, setDeveloperAutoRefresh] = useState(false);
  const [landingPhotos, setLandingPhotos] = useState<{ id: string; title: string; imageUrl: string }[]>([]);
  const [landingVideos, setLandingVideos] = useState<{ id: string; title: string; videoUrl: string }[]>([]);
  const [landingMediaProcessing, setLandingMediaProcessing] = useState(0);
  const [newAdminForm, setNewAdminForm] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [newAdminPermissions, setNewAdminPermissions] = useState<string[]>([]);
  const [editingAdminPermissionsById, setEditingAdminPermissionsById] = useState<Record<number, string[]>>({});
  const [developerAdmins, setDeveloperAdmins] = useState<any[]>([]);
  const [passwordTargetAdminId, setPasswordTargetAdminId] = useState<string>("");
  const [passwordTargetUsername, setPasswordTargetUsername] = useState("");
  const [passwordTargetValue, setPasswordTargetValue] = useState("");
  const [adminThemeKey, setAdminThemeKey] = useState<AdminThemeKey>(() => {
    const saved = window.localStorage.getItem("admin_theme_key");
    if (saved && saved in ADMIN_THEMES) return saved as AdminThemeKey;
    return "original";
  });

  const myAdminPermissions = useMemo(() => {
    try {
      const parsed = JSON.parse((user as any)?.adminPermissions ?? "[]");
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }, [(user as any)?.adminPermissions]);

  const canAccess = (permission: string) => myAdminPermissions.length === 0 || myAdminPermissions.includes(permission);
  const canViewTab = (tab: AdminTab) => canAccess(tab);
  const adminTheme = ADMIN_THEMES[adminThemeKey];

  const exportCsv = (filename: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const v = row[h] == null ? "" : String(row[h]);
            const safe = v.replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [newService, setNewService] = useState({ name: "", price: "", durationMinutes: "" });
  const [newBranch, setNewBranch] = useState({ name: "", location: "" });
  const [newBarber, setNewBarber] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    branchId: "",
    yearsOfExperience: "",
    bio: "",
    photoUrl: "",
    role: "barber",
  });

  const normalizedAppointments = useMemo(
    () =>
      (appointments ?? []).map((a) => ({
        ...a,
        id: Number(a.id),
        barberId: Number(a.barberId),
        branchId: Number(a.branchId),
        clientId: a.clientId == null ? null : Number(a.clientId),
      })),
    [appointments],
  );
  const branchById = useMemo(() => new Map(branches?.map((b) => [Number(b.id), b]) ?? []), [branches]);
  const barberById = useMemo(() => new Map(barbers?.map((b) => [Number(b.id), b]) ?? []), [barbers]);
  const activeAppointments = normalizedAppointments.filter((a) => a.status === "pending");
  const historyAppointments = normalizedAppointments.filter((a) => a.status !== "pending");
  const appointmentStats = {
    total: normalizedAppointments.length,
    pending: activeAppointments.length,
    completed: normalizedAppointments.filter((a) => a.status === "completed").length,
  };
  const statusChipClass = (status: string) => {
    if (status === "accepted") return "status-chip status-chip--accepted";
    if (status === "rejected") return "status-chip status-chip--rejected";
    if (status === "completed") return "status-chip status-chip--completed";
    if (status === "postponed") return "status-chip status-chip--postponed";
    return "status-chip status-chip--pending";
  };
  const scheduleRows = [...normalizedAppointments].sort(
    (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime(),
  );
  const timetableDays = useMemo(() => {
    const dayMap = new Map<string, Date>();
    scheduleRows.forEach((a) => {
      const dt = new Date(a.appointmentDate);
      const key = format(dt, "yyyy-MM-dd");
      if (!dayMap.has(key)) dayMap.set(key, dt);
    });
    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([key, dt]) => ({ key, label: format(dt, "EEE, MMM d") }));
  }, [scheduleRows]);
  const timetableSlots = useMemo(() => {
    const slots = new Set<string>();
    scheduleRows.forEach((a) => slots.add(format(new Date(a.appointmentDate), "HH:mm")));
    return Array.from(slots).sort();
  }, [scheduleRows]);
  const timetableMap = useMemo(() => {
    const map = new Map<string, typeof scheduleRows>();
    scheduleRows.forEach((a) => {
      const dt = new Date(a.appointmentDate);
      const key = `${format(dt, "yyyy-MM-dd")}|${format(dt, "HH:mm")}`;
      const existing = map.get(key) ?? [];
      existing.push(a);
      map.set(key, existing);
    });
    return map;
  }, [scheduleRows]);
  const barberReports = (barbers ?? [])
    .filter((b) => b.role === "barber")
    .map((b) => {
      const items = normalizedAppointments.filter((a) => Number(a.barberId) === Number(b.id));
      return {
        id: b.id,
        name: `${b.firstName} ${b.lastName}`,
        total: items.length,
        pending: items.filter((a) => a.status === "pending").length,
        accepted: items.filter((a) => a.status === "accepted").length,
        completed: items.filter((a) => a.status === "completed").length,
      };
    });

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createService.mutateAsync({
        name: newService.name,
        price: Number.parseInt(newService.price, 10),
        durationMinutes: Number.parseInt(newService.durationMinutes, 10),
      });
      toast({ title: "Service created" });
      setNewService({ name: "", price: "", durationMinutes: "" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBranch.mutateAsync(newBranch);
      toast({ title: "Branch created" });
      setNewBranch({ name: "", location: "" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSaveService = async () => {
    if (!editingService) return;
    try {
      await updateService.mutateAsync({
        id: editingService.id,
        data: {
          name: editingService.name,
          price: editingService.price,
          durationMinutes: editingService.durationMinutes,
        },
      });
      toast({ title: "Service updated" });
      setEditingService(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleCreateBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBarber.mutateAsync({
        ...newBarber,
        branchId: newBarber.branchId ? Number.parseInt(newBarber.branchId, 10) : null,
        yearsOfExperience: newBarber.yearsOfExperience ? Number.parseInt(newBarber.yearsOfExperience, 10) : null,
      });
      toast({ title: "Barber account created" });
      setNewBarber({
        username: "",
        password: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        branchId: "",
        yearsOfExperience: "",
        bio: "",
        photoUrl: "",
        role: "barber",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSaveBarber = async () => {
    if (!editingBarber) return;
    try {
      await updateBarber.mutateAsync({
        id: editingBarber.id,
        data: {
          firstName: editingBarber.firstName,
          lastName: editingBarber.lastName,
          email: editingBarber.email,
          phone: editingBarber.phone,
          branchId: editingBarber.branchId,
          yearsOfExperience: editingBarber.yearsOfExperience,
          bio: editingBarber.bio,
          photoUrl: editingBarber.photoUrl,
          password: editingBarberPassword || undefined,
        },
      });
      toast({ title: "Barber updated" });
      setEditingBarber(null);
      setEditingBarberPassword("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleStatus = async (id: number, status: string, proposedDate?: string) => {
    try {
      await updateStatus.mutateAsync({ id, status, proposedDate });
      toast({ title: `Appointment ${status}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSendAppointmentMessage = async () => {
    if (!selectedAppointment || !adminMessageText.trim()) return;
    try {
      await sendAdminMessage.mutateAsync({ appointmentId: selectedAppointment.id, message: adminMessageText.trim() });
      toast({ title: "Message sent" });
      setAdminMessageText("");
      setSelectedAppointment(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const loadGroups = async () => {
    const res = await fetch(api.chat.groups.path, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setGroups(data);
    const totals: Record<number, number> = {};
    for (const g of data) {
      const totalRes = await fetch(api.chat.totals.path.replace(":id", String(g.id)), { credentials: "include" });
      if (totalRes.ok) {
        const t = await totalRes.json();
        totals[g.id] = t.groupTotal;
      }
    }
    setGroupTotalsByGroup(totals);
  };

  const loadExpenses = async () => {
    const res = await fetch(api.expenses.list.path, { credentials: "include" });
    if (!res.ok) return;
    setExpenseItems(await res.json());
  };

  const loadAdminUsers = async (type: "all" | "barber" | "client" = userViewType) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${api.admin.usersList.path}?type=${type}`, { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Failed to load users", description: payload?.message ?? "Request failed" });
        return;
      }
      setAdminUsers(Array.isArray(payload.users) ? payload.users : []);
      setAdminUsersNote(typeof payload.note === "string" ? payload.note : "");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadDeveloperSnapshot = async () => {
    setDeveloperLoading(true);
    try {
      const res = await fetch(api.admin.developerSnapshot.path, { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Failed to load developer monitor", description: payload?.message ?? "Request failed" });
        return;
      }
      setDeveloperSnapshot(payload.snapshot ?? null);
      if (payload.snapshot?.dbSchema) setDeveloperSchema(payload.snapshot.dbSchema);
      if (payload.snapshot?.sqlMonitoring) setDeveloperSqlReport(payload.snapshot.sqlMonitoring);
    } finally {
      setDeveloperLoading(false);
    }
  };

  const loadDeveloperSchema = async () => {
    const res = await fetch(api.admin.developerSchema.path, { credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "Failed to load schema", description: payload?.message ?? "Request failed" });
      return;
    }
    setDeveloperSchema(payload.schema ?? null);
  };

  const loadDeveloperSqlReport = async () => {
    const res = await fetch(api.admin.developerSqlReport.path, { credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "Failed to load SQL report", description: payload?.message ?? "Request failed" });
      return;
    }
    setDeveloperSqlReport(payload.report ?? null);
  };

  const loadDeveloperAdmins = async () => {
    const res = await fetch(api.admin.adminsList.path, { credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "Failed to load admins", description: payload?.message ?? "Request failed" });
      return;
    }
    setDeveloperAdmins(Array.isArray(payload.admins) ? payload.admins : []);
  };

  const exportDeveloperData = async () => {
    const res = await fetch(api.admin.developerExport.path, { credentials: "include" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Export failed", description: payload?.message ?? "Request failed" });
      return;
    }
    const blob = await res.blob();
    const contentDisposition = res.headers.get("content-disposition") ?? "";
    const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] ?? `developer-export-${Date.now()}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportDeveloperSqlTemplate = async () => {
    const res = await fetch(api.admin.developerSqlExport.path, { credentials: "include" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "SQL export failed", description: payload?.message ?? "Request failed" });
      return;
    }
    const blob = await res.blob();
    const contentDisposition = res.headers.get("content-disposition") ?? "";
    const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] ?? `developer-sql-report-${Date.now()}.sql`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSchemaJson = async () => {
    const res = await fetch(api.admin.developerSchema.path, { credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "Schema export failed", description: payload?.message ?? "Request failed" });
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `developer-schema-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const requestDeveloperAccess = () => {
    if (developerUnlocked) return true;
    const entered = window.prompt("Developer password:");
    if (entered === "memo") {
      setDeveloperUnlocked(true);
      toast({ title: "Developer access granted" });
      return true;
    }
    toast({ variant: "destructive", title: "Wrong password for Developer tab" });
    return false;
  };

  const loadGroupMessages = async (groupId: number) => {
    const res = await fetch(api.chat.messages.path.replace(":id", String(groupId)), { credentials: "include" });
    if (res.ok) setGroupMessages(await res.json());
    const totalRes = await fetch(api.chat.totals.path.replace(":id", String(groupId)), { credentials: "include" });
    if (totalRes.ok) setGroupTotals(await totalRes.json());
    const membersRes = await fetch(api.chat.members.path.replace(":id", String(groupId)), { credentials: "include" });
    if (membersRes.ok) {
      const rows = await membersRes.json();
      setEditingGroupMembers(rows.map((r: { userId: number }) => r.userId).filter((id: number) => id !== (user?.id ?? -1)));
    }
  };

  const exportGroupContextExcel = async (groupId: number) => {
    try {
      const group = groups.find((g) => Number(g.id) === Number(groupId));
      if (!group) return toast({ variant: "destructive", title: "Group not found" });

      const [messagesRes, totalsRes, membersRes] = await Promise.all([
        fetch(api.chat.messages.path.replace(":id", String(groupId)), { credentials: "include" }),
        fetch(api.chat.totals.path.replace(":id", String(groupId)), { credentials: "include" }),
        fetch(api.chat.members.path.replace(":id", String(groupId)), { credentials: "include" }),
      ]);

      if (!messagesRes.ok || !totalsRes.ok || !membersRes.ok) {
        return toast({ variant: "destructive", title: "Export failed", description: "Could not load full group context." });
      }

      const messages = await messagesRes.json();
      const totals = await totalsRes.json();
      const members = await membersRes.json();
      const { utils, writeFile } = await import("xlsx");

      const metaRows = [
        { field: "Group ID", value: group.id },
        { field: "Group Name", value: group.name },
        { field: "Mode", value: group.mode },
        { field: "Group Total", value: totals.groupTotal ?? 0 },
        { field: "Exported At", value: new Date().toISOString() },
      ];

      const memberRows = members.map((m: { userId: number }) => {
        const barber = (barbers ?? []).find((b) => Number(b.id) === Number(m.userId));
        const isCurrentAdmin = Number(user?.id ?? -1) === Number(m.userId);
        return {
          userId: m.userId,
          name: barber ? `${barber.firstName} ${barber.lastName}` : isCurrentAdmin ? `${user?.firstName ?? "Admin"} ${user?.lastName ?? ""}`.trim() : `User #${m.userId}`,
        };
      });

      const totalsRows = (totals.byUser ?? []).map((row: { userId: number; total: number }) => {
        const member = memberRows.find((m: { userId: number; name: string }) => Number(m.userId) === Number(row.userId));
        return { userId: row.userId, name: member?.name ?? `User #${row.userId}`, total: row.total };
      });

      const messageRows = [...messages]
        .reverse()
        .map((m: { id: number; userId: number; senderName?: string; senderRole?: string; content: string; numericValue?: number | null; createdAt: string }) => ({
          id: m.id,
          createdAt: m.createdAt,
          userId: m.userId,
          senderName: m.senderName ?? `User #${m.userId}`,
          senderRole: m.senderRole ?? "unknown",
          numericValue: m.numericValue ?? "",
          content: m.content,
        }));

      const wb = utils.book_new();
      utils.book_append_sheet(wb, utils.json_to_sheet(metaRows), "Meta");
      utils.book_append_sheet(wb, utils.json_to_sheet(memberRows), "Members");
      utils.book_append_sheet(wb, utils.json_to_sheet(totalsRows), "Totals");
      utils.book_append_sheet(wb, utils.json_to_sheet(messageRows), "Messages");
      writeFile(wb, `group-${group.id}-${String(group.name).replace(/[^a-z0-9_-]+/gi, "_")}.xlsx`);
      toast({ title: "Group exported to Excel" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export failed", description: err.message || "Could not export group context." });
    }
  };

  const deleteGroup = async (groupId: number) => {
    if (!window.confirm("Delete this group and all its messages permanently?")) return;
    const res = await fetch(buildUrl(api.chat.deleteGroup.path, { id: groupId }), {
      method: api.chat.deleteGroup.method,
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast({ variant: "destructive", title: "Delete failed", description: data.message || "Could not delete group." });
    toast({ title: "Group deleted" });
    if (activeGroupId === groupId) {
      setActiveGroupId(null);
      setGroupMessages([]);
      setGroupTotals(null);
      setEditingGroupMembers([]);
    }
    await loadGroups();
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });

  const readImageAsCompressedDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const max = 1280;
            const ratio = Math.min(1, max / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas is not supported."));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.72));
          } catch {
            reject(new Error("Could not compress image."));
          }
        };
        img.onerror = () => reject(new Error("Invalid image file."));
        img.src = String(reader.result ?? "");
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });

  const handleSaveLandingMedia = async () => {
    if (landingMediaProcessing > 0) {
      toast({ variant: "destructive", title: "Please wait", description: "File processing is still running." });
      return;
    }
    try {
      const cleanPhotos = landingPhotos
        .map((p) => ({ id: String(p.id), title: String(p.title ?? "").trim(), imageUrl: String(p.imageUrl ?? "").trim() }))
        .filter((p) => p.imageUrl.length > 0);
      const cleanVideos = landingVideos
        .map((v) => ({ id: String(v.id), title: String(v.title ?? "").trim(), videoUrl: String(v.videoUrl ?? "").trim() }))
        .filter((v) => v.videoUrl.length > 0);
      await saveLandingMedia.mutateAsync({ photos: cleanPhotos, videos: cleanVideos });
      setLandingPhotos(cleanPhotos);
      setLandingVideos(cleanVideos);
      toast({ title: "Landing gallery saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save landing media." });
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(api.admin.createAdmin.path, {
        method: api.admin.createAdmin.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...newAdminForm,
          permissions: newAdminPermissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create admin");
      toast({ title: "Admin account created" });
      setNewAdminForm({ username: "", password: "", firstName: "", lastName: "", email: "", phone: "" });
      setNewAdminPermissions([]);
      void loadAdminUsers("all");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Create failed", description: err.message });
    }
  };

  const handleSaveAdminPermissions = async (adminId: number) => {
    try {
      const permissions = editingAdminPermissionsById[adminId] ?? [];
      const res = await fetch(buildUrl(api.admin.updateAdminPermissions.path, { id: adminId }), {
        method: api.admin.updateAdminPermissions.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update permissions");
      toast({ title: "Admin permissions updated" });
      void loadAdminUsers("all");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
  };

  const handleChangeAdminPassword = async () => {
    const targetId = Number.parseInt(passwordTargetAdminId, 10);
    if (!Number.isFinite(targetId)) {
      toast({ variant: "destructive", title: "Select an admin first" });
      return;
    }
    if (passwordTargetValue && passwordTargetValue.length < 6) {
      toast({ variant: "destructive", title: "Password must be at least 6 characters" });
      return;
    }
    try {
      const body: { username?: string; password?: string } = {};
      if (passwordTargetUsername.trim().length >= 3) {
        body.username = passwordTargetUsername.trim();
      }
      if (passwordTargetValue.length >= 6) {
        body.password = passwordTargetValue;
      }
      if (!body.username && !body.password) {
        toast({ variant: "destructive", title: "Add a username or password to update" });
        return;
      }
      const res = await fetch(buildUrl(api.admin.changeAdminPassword.path, { id: targetId }), {
        method: api.admin.changeAdminPassword.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to change password");
      toast({ title: "Admin credentials updated" });
      void loadDeveloperAdmins();
      setPasswordTargetValue("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Password change failed", description: err.message });
    }
  };

  useEffect(() => {
    if (!settings) return;
    setWallBg(settings.wallDisplayBackground);
    setSoundChoice(settings.notificationSound);
    setWallShowWeather(settings.wallShowWeather);
    setWallShowMusic(settings.wallShowMusic);
    setWallQueueLimit(String(settings.wallQueueLimit));
  }, [settings]);

  useEffect(() => {
    if (!landingMedia) return;
    const normalizedPhotos = (landingMedia.photos ?? []).map((p: any, idx: number) => ({
      id: String(p?.id ?? `photo-${idx}`),
      title: String(p?.title ?? ""),
      imageUrl: String(p?.imageUrl ?? p?.image_url ?? p?.url ?? ""),
    }));
    const normalizedVideos = (landingMedia.videos ?? []).map((v: any, idx: number) => ({
      id: String(v?.id ?? `video-${idx}`),
      title: String(v?.title ?? ""),
      videoUrl: String(v?.videoUrl ?? v?.video_url ?? v?.url ?? ""),
    }));
    setLandingPhotos(normalizedPhotos);
    setLandingVideos(normalizedVideos);
  }, [landingMedia]);

  useEffect(() => {
    void loadExpenses();
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      void loadAdminUsers(userViewType);
    }
    if (activeTab === "developer") {
      void loadDeveloperSnapshot();
      void loadDeveloperAdmins();
    }
  }, [activeTab, userViewType]);

  useEffect(() => {
    if (!(activeTab === "developer" && developerAutoRefresh)) return;
    const timer = window.setInterval(() => {
      void loadDeveloperSnapshot();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeTab, developerAutoRefresh]);

  useEffect(() => {
    if (canViewTab(activeTab)) return;
    const fallback = ([
      "appointments",
      "barbers",
      "services",
      "reports",
      "timetable",
      "finance",
      "chat",
      "wallDisplay",
      "gallery",
      "users",
      "growth",
      "developer",
    ] as AdminTab[]).find((t) => canViewTab(t));
    if (fallback) setActiveTab(fallback);
  }, [activeTab, myAdminPermissions]);

  useEffect(() => {
    const map: Record<number, string[]> = {};
    adminUsers
      .filter((u) => u.role === "admin")
      .forEach((u) => {
        try {
          const parsed = JSON.parse(u.adminPermissions ?? "[]");
          map[Number(u.id)] = Array.isArray(parsed) ? parsed.map((v: any) => String(v)) : [];
        } catch {
          map[Number(u.id)] = [];
        }
      });
    setEditingAdminPermissionsById(map);
  }, [adminUsers]);

  useEffect(() => {
    window.localStorage.setItem("admin_theme_key", adminThemeKey);
  }, [adminThemeKey]);

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading dashboard...</div>;
  if (user?.role !== "admin") return <div className="p-8 text-center text-red-500">Access denied. Admin only.</div>;

  return (
    <div
      className={`admin-theme ${adminThemeKey !== "original" ? "theme-custom" : ""} min-h-screen flex flex-col md:flex-row ${activeTab === "developer" ? "admin-dark-theme bg-black text-white" : "bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-slate-900 text-zinc-900 dark:text-zinc-100"}`}
      style={
        adminThemeKey !== "original"
          ? ({
              "--admin-primary": adminTheme.primary,
              "--admin-secondary": adminTheme.secondary,
              "--admin-accent": adminTheme.accent,
              "--admin-bg": adminTheme.background,
              "--admin-card": adminTheme.card,
              "--admin-text": adminTheme.text,
              "--admin-border": adminTheme.secondary,
            } as CSSProperties)
          : undefined
      }
    >
      <style>{`
        .admin-theme.theme-custom {
          background: var(--admin-bg) !important;
          color: var(--admin-text) !important;
        }
        .admin-theme.theme-custom aside,
        .admin-theme.theme-custom main {
          background: var(--admin-bg) !important;
          color: var(--admin-text) !important;
        }
        .admin-theme.theme-custom .bg-white,
        .admin-theme.theme-custom .bg-white\\/85,
        .admin-theme.theme-custom .bg-amber-50,
        .admin-theme.theme-custom .bg-orange-50,
        .admin-theme.theme-custom .bg-stone-100,
        .admin-theme.theme-custom .rounded-xl,
        .admin-theme.theme-custom .card {
          background: var(--admin-card) !important;
          color: var(--admin-text) !important;
          border-color: color-mix(in srgb, var(--admin-border) 28%, white) !important;
        }
        .admin-theme.theme-custom .text-zinc-500,
        .admin-theme.theme-custom .text-zinc-400,
        .admin-theme.theme-custom .text-zinc-600 {
          color: color-mix(in srgb, var(--admin-text) 72%, white) !important;
        }
        .admin-theme.theme-custom [role="tab"] {
          color: var(--admin-primary) !important;
          background: color-mix(in srgb, var(--admin-card) 88%, var(--admin-bg)) !important;
          border: 1px solid color-mix(in srgb, var(--admin-border) 35%, white) !important;
        }
        .admin-theme.theme-custom .admin-link-blur {
          color: #2563eb !important;
          background: color-mix(in srgb, var(--admin-card) 88%, var(--admin-bg)) !important;
          border: 1px solid color-mix(in srgb, #2563eb 35%, white) !important;
        }
        .admin-theme.theme-custom [role="tab"][data-state="active"] {
          color: white !important;
          background: var(--admin-primary) !important;
          border-color: var(--admin-accent) !important;
        }
        .admin-theme.theme-custom .admin-link-blur:hover {
          background: color-mix(in srgb, #2563eb 14%, var(--admin-card)) !important;
          color: #2563eb !important;
        }
        .admin-theme.theme-custom .border-amber-100,
        .admin-theme.theme-custom .border-amber-200 {
          border-color: color-mix(in srgb, var(--admin-border) 32%, white) !important;
        }
        .admin-dark-theme {
          background: #050505 !important;
          color: #ffffff !important;
        }
        .admin-dark-theme aside,
        .admin-dark-theme main {
          background: #070707 !important;
          color: #ffffff !important;
        }
        .admin-dark-theme .bg-white,
        .admin-dark-theme .bg-white\\/85,
        .admin-dark-theme .bg-amber-50,
        .admin-dark-theme .bg-orange-50,
        .admin-dark-theme .bg-stone-100,
        .admin-dark-theme .rounded-xl,
        .admin-dark-theme .card {
          background: #121212 !important;
          color: #ffffff !important;
          border-color: #2a2a2a !important;
        }
        .admin-dark-theme .text-zinc-500,
        .admin-dark-theme .text-zinc-400,
        .admin-dark-theme .text-zinc-600 {
          color: #d1d5db !important;
        }
        .admin-dark-theme [role="tab"],
        .admin-dark-theme .admin-link-blur {
          color: #93c5fd !important;
          background: rgba(20, 20, 25, 0.55) !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .admin-dark-theme [role="tab"][data-state="active"] {
          color: #ffffff !important;
          background: rgba(37, 99, 235, 0.35) !important;
          border-color: rgba(147, 197, 253, 0.6) !important;
        }
        .admin-dark-theme .admin-link-blur:hover {
          background: rgba(37, 99, 235, 0.2) !important;
          color: #bfdbfe !important;
        }
        .admin-dark-theme pre {
          color: #f3f4f6 !important;
        }
      `}</style>
      <aside className={`w-full md:w-72 p-6 flex flex-col ${activeTab === "developer" ? "bg-black/80 backdrop-blur-xl border-r border-blue-400/30" : "bg-white/85 dark:bg-zinc-900/80 backdrop-blur border-r border-amber-200 dark:border-zinc-800"}`}>
        <h2 className="text-2xl font-semibold mb-2">Istanbul Salon</h2>
        <div className="mb-8 flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Admin Control</p>
          <Button type="button" variant="outline" size="icon" title={`Theme: ${themeMode}`} onClick={toggleTheme}>
            {themeMode === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mb-4">
          <Label className="text-xs text-zinc-500 mb-2 block">Dashboard Theme</Label>
          <Select value={adminThemeKey} onValueChange={(value) => setAdminThemeKey(value as AdminThemeKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_THEME_ORDER.map((key) => (
                (() => {
                  const theme = ADMIN_THEMES[key];
                  return (
                <SelectItem key={`admin-theme-${key}`} value={key}>
                  {theme.label}
                </SelectItem>
                  );
                })()
              ))}
            </SelectContent>
          </Select>
        </div>
        <nav className="space-y-2 flex-1">
          {canViewTab("appointments") && (
          <Button variant={activeTab === "appointments" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("appointments")}>
            <CalendarDays className="mr-3 h-5 w-5" /> Appointments
          </Button>
          )}
          {canViewTab("barbers") && (
          <Button variant={activeTab === "barbers" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("barbers")}>
            <Users className="mr-3 h-5 w-5" /> Barbers & Branches
          </Button>
          )}
          {canViewTab("services") && (
          <Button variant={activeTab === "services" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("services")}>
            <Scissors className="mr-3 h-5 w-5" /> Services
          </Button>
          )}
          {canViewTab("reports") && (
          <Button variant={activeTab === "reports" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("reports")}>
            <FileBarChart2 className="mr-3 h-5 w-5" /> Reports
          </Button>
          )}
          {canViewTab("timetable") && (
          <Button variant={activeTab === "timetable" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("timetable")}>
            <CalendarDays className="mr-3 h-5 w-5" /> Timetable
          </Button>
          )}
          {canViewTab("finance") && (
          <Button variant={activeTab === "finance" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("finance")}>
            <BarChart3 className="mr-3 h-5 w-5" /> Finance
          </Button>
          )}
          {canViewTab("chat") && (
          <Button variant={activeTab === "chat" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => { setActiveTab("chat"); void loadGroups(); }}>
            <MessageSquareText className="mr-3 h-5 w-5" /> Group Chat
          </Button>
          )}
          {canViewTab("wallDisplay") && (
          <Button variant={activeTab === "wallDisplay" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("wallDisplay")}>
            <CalendarDays className="mr-3 h-5 w-5" /> Wall Display
          </Button>
          )}
          {canViewTab("gallery") && (
          <Button variant={activeTab === "gallery" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("gallery")}>
            <ImageIcon className="mr-3 h-5 w-5" /> Gallery
          </Button>
          )}
          {canViewTab("users") && (
          <Button variant={activeTab === "users" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("users")}>
            <Users className="mr-3 h-5 w-5" /> Users
          </Button>
          )}
          {canViewTab("growth") && (
          <Button variant={activeTab === "growth" ? "default" : "ghost"} className="w-full justify-start admin-link-blur" onClick={() => setActiveTab("growth")}>
            <BarChart3 className="mr-3 h-5 w-5" /> Growth & Ops
          </Button>
          )}
          {canViewTab("developer") && (
          <Button
            variant={activeTab === "developer" ? "default" : "ghost"}
            className="w-full justify-start admin-link-blur"
            onClick={() => {
              if (!requestDeveloperAccess()) return;
              setActiveTab("developer");
            }}
          >
            <BarChart3 className="mr-3 h-5 w-5" /> Developer
          </Button>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-amber-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold">{user.firstName[0]}</div>
            <div>
              <p className="text-sm font-semibold">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-zinc-500">Administrator</p>
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

      <main className={`flex-1 p-6 md:p-8 overflow-y-auto ${activeTab === "developer" ? "bg-black text-white" : ""}`}>
        <h1 className="text-3xl font-semibold mb-8">Operations Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white border-amber-100">
            <CardHeader className="pb-2"><CardTitle className="text-zinc-500 text-sm font-medium">Total Appointments</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{appointmentStats.total}</p></CardContent>
          </Card>
          <Card className="bg-white border-amber-100">
            <CardHeader className="pb-2"><CardTitle className="text-zinc-500 text-sm font-medium">Pending</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{appointmentStats.pending}</p></CardContent>
          </Card>
          <Card className="bg-white border-amber-100">
            <CardHeader className="pb-2"><CardTitle className="text-zinc-500 text-sm font-medium">Completed</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{appointmentStats.completed}</p></CardContent>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = v as AdminTab;
            if (next === "developer" && !requestDeveloperAccess()) return;
            setActiveTab(next);
          }}
          className="w-full"
        >
          <TabsList className="bg-white border border-amber-100 mb-6 w-full overflow-x-auto flex-wrap h-auto">
            {canViewTab("appointments") && <TabsTrigger value="appointments">Appointments</TabsTrigger>}
            {canViewTab("barbers") && <TabsTrigger value="barbers">Barbers & Branches</TabsTrigger>}
            {canViewTab("services") && <TabsTrigger value="services">Services</TabsTrigger>}
            {canViewTab("reports") && <TabsTrigger value="reports">Reports</TabsTrigger>}
            {canViewTab("timetable") && <TabsTrigger value="timetable">Timetable</TabsTrigger>}
            {canViewTab("finance") && <TabsTrigger value="finance">Finance</TabsTrigger>}
            {canViewTab("chat") && <TabsTrigger value="chat">Group Chat</TabsTrigger>}
            {canViewTab("wallDisplay") && <TabsTrigger value="wallDisplay">Wall Display</TabsTrigger>}
            {canViewTab("gallery") && <TabsTrigger value="gallery">Gallery</TabsTrigger>}
            {canViewTab("users") && <TabsTrigger value="users">Users</TabsTrigger>}
            {canViewTab("growth") && <TabsTrigger value="growth">Growth & Ops</TabsTrigger>}
            {canViewTab("developer") && <TabsTrigger value="developer">Developer</TabsTrigger>}
          </TabsList>

          <TabsContent value="appointments" className="space-y-6">
            <div className="bg-white border border-amber-100 rounded-xl p-5">
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedForDelete(new Set(normalizedAppointments.filter((a) => a.status === "completed").map((a) => a.id)))}
                >
                  Select All Completed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedForDelete(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCsv(
                      "appointments-history.csv",
                      historyAppointments.map((a) => ({
                        id: a.id,
                        dateTime: format(new Date(a.appointmentDate), "yyyy-MM-dd HH:mm"),
                        client: a.guestFirstName ? `${a.guestFirstName} ${a.guestLastName ?? ""}` : "Registered Client",
                        phone: a.guestPhone ?? "",
                        email: a.guestEmail ?? "",
                        barber: barberById.get(Number(a.barberId))?.firstName ?? a.barberId,
                        status: a.status,
                      })),
                    )
                  }
                >
                  Export Excel (CSV)
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selectedForDelete.size === 0}
                  onClick={async () => {
                    const res = await fetch(api.admin.deleteAppointments.path, {
                      method: api.admin.deleteAppointments.method,
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        ids: Array.from(selectedForDelete)
                          .map((id) => Number(id))
                          .filter((id) => Number.isFinite(id)),
                      }),
                    });
                    const payload = await res.json().catch(() => ({}));
                    if (!res.ok) return toast({ variant: "destructive", title: "Failed to delete", description: payload.message });
                    toast({ title: `Deleted ${payload.deleted ?? 0} appointments` });
                    setSelectedForDelete(new Set());
                    await queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
                  }}
                >
                  Delete Selected
                </Button>
              </div>
            </div>
            <div className="bg-white border border-amber-100 rounded-xl p-5">
              <h3 className="text-xl font-semibold mb-4">Active Queue (Pending Only)</h3>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Barber</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">{format(new Date(apt.appointmentDate), "MMM do, HH:mm")}</TableCell>
                      <TableCell>{apt.guestFirstName ? `${apt.guestFirstName} ${apt.guestLastName ?? ""}` : "Registered Client"}</TableCell>
                      <TableCell>{apt.guestPhone || "-"}</TableCell>
                      <TableCell>{apt.guestEmail || "-"}</TableCell>
                      <TableCell>{barberById.get(Number(apt.barberId))?.firstName ?? `#${apt.barberId}`}</TableCell>
                      <TableCell>{branchById.get(Number(apt.branchId))?.name ?? `#${apt.branchId}`}</TableCell>
                      <TableCell><span className={statusChipClass(apt.status)}>{apt.status}</span></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white" onClick={() => handleStatus(apt.id, "accepted")} disabled={updateStatus.isPending}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-500 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                            onClick={() => {
                              const input = window.prompt("Pick new date/time (YYYY-MM-DDTHH:mm)", format(new Date(apt.appointmentDate), "yyyy-MM-dd'T'HH:mm"));
                              if (!input) return;
                              void handleStatus(apt.id, "postponed", new Date(input).toISOString());
                            }}
                            disabled={updateStatus.isPending}
                          >
                            <Clock3 className="h-3 w-3 mr-1" /> Postpone
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50" onClick={() => handleStatus(apt.id, "rejected")} disabled={updateStatus.isPending}>
                            <CircleX className="h-3 w-3 mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-cyan-600 text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                            onClick={() => setSelectedAppointment(apt)}
                          >
                            <MessageSquareText className="h-3 w-3 mr-1" /> Contact
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>

            <div className="bg-white border border-amber-100 rounded-xl p-5">
              <h3 className="text-xl font-semibold mb-4">History (Processed)</h3>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Barber</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyAppointments.map((apt) => (
                    <TableRow key={`history-${apt.id}`}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedForDelete.has(Number(apt.id))}
                          onChange={(e) => {
                            setSelectedForDelete((prev) => {
                              const next = new Set(prev);
                              const appointmentId = Number(apt.id);
                              if (e.target.checked) next.add(appointmentId);
                              else next.delete(appointmentId);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(apt.appointmentDate), "MMM do, HH:mm")}</TableCell>
                      <TableCell>{apt.guestFirstName ? `${apt.guestFirstName} ${apt.guestLastName ?? ""}` : "Registered Client"}</TableCell>
                      <TableCell>{apt.guestPhone || "-"}</TableCell>
                      <TableCell>{apt.guestEmail || "-"}</TableCell>
                      <TableCell>{barberById.get(Number(apt.barberId))?.firstName ?? `#${apt.barberId}`}</TableCell>
                      <TableCell><span className={statusChipClass(apt.status)}>{apt.status}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="finance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Profit (Today)</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">${earnings?.totalProfit ?? 0}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Expenses (Today)</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">${earnings?.totalExpenses ?? 0}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Net Profit</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">${earnings?.netProfit ?? 0}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Branch Daily</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">${earnings?.branchDailyTotal ?? 0}</p></CardContent></Card>
            </div>
            <div className="bg-white border rounded-xl p-5 space-y-3">
              <h3 className="text-lg font-semibold">Add Expense</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input placeholder="Expense title" value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} />
                <Input type="number" placeholder="Amount" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                <Button onClick={async () => {
                  if (!expenseTitle.trim()) return toast({ variant: "destructive", title: "Title is required" });
                  const amount = Number(expenseAmount || 0);
                  if (!Number.isFinite(amount) || amount < 0) return toast({ variant: "destructive", title: "Invalid amount" });
                  const res = await fetch(api.expenses.create.path, {
                    method: api.expenses.create.method,
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ title: expenseTitle.trim(), amount, branchId: null }),
                  });
                  if (!res.ok) return toast({ variant: "destructive", title: "Failed to add expense" });
                  toast({ title: "Expense added" });
                  setExpenseTitle("");
                  setExpenseAmount("");
                  await loadExpenses();
                  await queryClient.invalidateQueries({ queryKey: [api.earnings.summary.path] });
                }}>Add</Button>
              </div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <h3 className="text-lg font-semibold mb-3">Expenses List</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseItems.map((item) => {
                      const isEditing = editingExpenseId === item.id;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {isEditing ? (
                              <Input value={editingExpenseTitle} onChange={(e) => setEditingExpenseTitle(e.target.value)} />
                            ) : (
                              item.title
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input type="number" value={editingExpenseAmount} onChange={(e) => setEditingExpenseAmount(e.target.value)} />
                            ) : (
                              `$${item.amount}`
                            )}
                          </TableCell>
                          <TableCell>{item.createdAt ? format(new Date(item.createdAt), "PPP p") : "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      if (!editingExpenseTitle.trim()) return toast({ variant: "destructive", title: "Title is required" });
                                      const amount = Number(editingExpenseAmount || 0);
                                      if (!Number.isFinite(amount) || amount < 0) return toast({ variant: "destructive", title: "Invalid amount" });
                                      const res = await fetch(buildUrl(api.expenses.update.path, { id: item.id }), {
                                        method: api.expenses.update.method,
                                        headers: { "Content-Type": "application/json" },
                                        credentials: "include",
                                        body: JSON.stringify({ title: editingExpenseTitle.trim(), amount }),
                                      });
                                      const data = await res.json().catch(() => ({}));
                                      if (!res.ok) return toast({ variant: "destructive", title: "Update failed", description: data.message });
                                      toast({ title: "Expense updated" });
                                      setEditingExpenseId(null);
                                      setEditingExpenseTitle("");
                                      setEditingExpenseAmount("");
                                      await loadExpenses();
                                      await queryClient.invalidateQueries({ queryKey: [api.earnings.summary.path] });
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingExpenseId(null);
                                      setEditingExpenseTitle("");
                                      setEditingExpenseAmount("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingExpenseId(item.id);
                                      setEditingExpenseTitle(item.title);
                                      setEditingExpenseAmount(String(item.amount));
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500 text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                      if (!window.confirm("Delete this expense?")) return;
                                      const res = await fetch(buildUrl(api.expenses.delete.path, { id: item.id }), {
                                        method: api.expenses.delete.method,
                                        credentials: "include",
                                      });
                                      const data = await res.json().catch(() => ({}));
                                      if (!res.ok) return toast({ variant: "destructive", title: "Delete failed", description: data.message });
                                      toast({ title: "Expense deleted" });
                                      await loadExpenses();
                                      await queryClient.invalidateQueries({ queryKey: [api.earnings.summary.path] });
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {expenseItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-zinc-500 py-6">
                          No expenses yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-3">Branch Profit</h3>
                <div className="space-y-2">
                  {(earnings?.branchTotals ?? []).map((b) => (
                    <div key={b.branchId} className="flex items-center justify-between border rounded p-2">
                      <span>{b.branchName}</span><strong>${b.total}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-3">Barber Profit</h3>
                <div className="space-y-2">
                  {(earnings?.barberTotals ?? []).map((b) => (
                    <div key={b.barberId} className="flex items-center justify-between border rounded p-2">
                      <span>{b.barberName}</span><strong>${b.total}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <Button
                onClick={() =>
                  exportCsv(
                    "finance-summary.csv",
                    [
                      { metric: "Total Profit", value: earnings?.totalProfit ?? 0 },
                      { metric: "Total Expenses", value: earnings?.totalExpenses ?? 0 },
                      { metric: "Net Profit", value: earnings?.netProfit ?? 0 },
                    ]
                      .concat((earnings?.branchTotals ?? []).map((b) => ({ metric: `Branch ${b.branchName}`, value: b.total })))
                      .concat((earnings?.barberTotals ?? []).map((b) => ({ metric: `Barber ${b.barberName}`, value: b.total }))),
                  )
                }
              >
                Export Finance Excel (CSV)
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="wallDisplay" className="space-y-6">
            <div className="bg-white border rounded-xl p-5 space-y-4">
              <h3 className="text-lg font-semibold">Wall Display Settings</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label>Background Image URL</Label>
                  <Input placeholder="https://..." value={wallBg} onChange={(e) => setWallBg(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>Alert Sound</Label>
                    <Select value={soundChoice} onValueChange={(v) => setSoundChoice(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chime">Chime</SelectItem>
                        <SelectItem value="beep">Beep</SelectItem>
                        <SelectItem value="ding">Ding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Queue Limit</Label>
                    <Input type="number" min="1" max="20" value={wallQueueLimit} onChange={(e) => setWallQueueLimit(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={wallShowWeather ? "default" : "outline"} onClick={() => setWallShowWeather((v) => !v)}>
                        Weather {wallShowWeather ? "On" : "Off"}
                      </Button>
                      <Button type="button" variant={wallShowMusic ? "default" : "outline"} onClick={() => setWallShowMusic((v) => !v)}>
                        Music {wallShowMusic ? "On" : "Off"}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => playNotificationTone(soundChoice)}
                  >
                    Test Sound
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        await saveSettings.mutateAsync({
                          wallDisplayBackground: wallBg,
                          notificationSound: soundChoice,
                          wallShowWeather,
                          wallShowMusic,
                          wallQueueLimit: Math.max(1, Math.min(20, Number(wallQueueLimit || "6"))),
                        });
                        toast({ title: "Wall settings saved" });
                      } catch (err: any) {
                        toast({ variant: "destructive", title: "Save failed", description: err.message });
                      }
                    }}
                    disabled={saveSettings.isPending}
                  >
                    {saveSettings.isPending ? "Saving..." : "Save Wall Display"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open("/display", "_blank")}
                  >
                    Open Wall Display
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <div className="bg-white border rounded-xl p-5 space-y-3">
              <h3 className="text-lg font-semibold">Create Group Chat</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                <Select value={groupMode} onValueChange={(v) => setGroupMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text_numbers">Text + Numbers</SelectItem>
                    <SelectItem value="numbers_only">Numbers only</SelectItem>
                  </SelectContent>
                </Select>
                <div className="md:col-span-2 rounded border p-2 max-h-28 overflow-y-auto">
                  {(barbers ?? []).map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={groupMembers.includes(Number(b.id))}
                        onChange={(e) => {
                          setGroupMembers((prev) => {
                            if (e.target.checked) return Array.from(new Set([...prev, Number(b.id)]));
                            return prev.filter((id) => id !== Number(b.id));
                          });
                        }}
                      />
                      <span>{b.firstName} {b.lastName}</span>
                    </label>
                  ))}
                </div>
                <Button onClick={async () => {
                  const res = await fetch(api.chat.createGroup.path, {
                    method: api.chat.createGroup.method,
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: groupName, mode: groupMode, memberIds: groupMembers }),
                  });
                  if (!res.ok) return toast({ variant: "destructive", title: "Failed to create group" });
                  toast({ title: "Group created" });
                  setGroupName("");
                  setGroupMembers([]);
                  void loadGroups();
                }}>Create</Button>
              </div>
              {groupMembers.length > 0 && <p className="text-sm text-zinc-500">Members selected: {groupMembers.join(", ")}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-xl p-4 space-y-2">
                <h3 className="font-semibold">Groups</h3>
                {groups.map((g) => (
                  <div key={g.id} className="border rounded-lg p-2 space-y-2">
                    <Button variant={activeGroupId === g.id ? "default" : "outline"} className="w-full justify-start" onClick={() => { setActiveGroupId(g.id); void loadGroupMessages(g.id); }}>
                      {g.name} ({g.mode === "numbers_only" ? "Numbers" : "Text+Numbers"}) - Total: {groupTotalsByGroup[g.id] ?? 0}
                    </Button>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="w-full" onClick={() => void exportGroupContextExcel(g.id)}>
                        Export Excel
                      </Button>
                      <Button size="sm" variant="outline" className="w-full border-red-500 text-red-600 hover:bg-red-50" onClick={() => void deleteGroup(g.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="md:col-span-2 bg-white border rounded-xl p-4 space-y-3">
                <h3 className="font-semibold">Messages</h3>
                {activeGroupId && (
                  <div className="border rounded p-3 space-y-2">
                    <p className="text-sm font-semibold">Manage Members</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                      {(barbers ?? []).map((b) => (
                        <label key={b.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editingGroupMembers.includes(b.id)}
                            onChange={(e) => {
                              setEditingGroupMembers((prev) => {
                                if (e.target.checked) return Array.from(new Set([...prev, b.id]));
                                return prev.filter((id) => id !== b.id);
                              });
                            }}
                          />
                          <span>{b.firstName} {b.lastName}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const res = await fetch(api.chat.updateMembers.path.replace(":id", String(activeGroupId)), {
                          method: api.chat.updateMembers.method,
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ memberIds: editingGroupMembers }),
                        });
                        if (!res.ok) return toast({ variant: "destructive", title: "Failed to update members" });
                        toast({ title: "Members updated" });
                      }}
                    >
                      Save Members
                    </Button>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {groupMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`border rounded p-2 text-sm ${m.senderRole === "admin" ? "bg-amber-50 border-amber-300" : "bg-white"}`}
                    >
                      <p>
                        <strong>{m.senderRole === "admin" ? "★ " : ""}{m.senderName || `User #${m.userId}`}:</strong> {m.content}
                      </p>
                    </div>
                  ))}
                </div>
                {activeGroupId && (
                  <div className="flex gap-2">
                    <Input value={groupMessageText} onChange={(e) => setGroupMessageText(e.target.value)} placeholder="Write message..." />
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
                      void loadGroupMessages(activeGroupId);
                    }}>Send</Button>
                  </div>
                )}
                {groupTotals && (
                  <div className="border rounded p-3">
                    <p className="font-semibold">Group Total: {groupTotals.groupTotal}</p>
                    <div className="space-y-1 mt-2">
                      {groupTotals.byUser.map((u) => (
                        <p key={u.userId} className="text-sm">User #{u.userId}: {u.total}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timetable" className="space-y-6">
            <AppointmentCalendar appointments={normalizedAppointments} barbers={barbers ?? []} allowDrag />
            <div className="bg-white border border-amber-100 rounded-xl p-5">
              <h3 className="text-xl font-semibold mb-4">Master Timetable (All Workers & Clients)</h3>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Barber</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleRows.map((apt) => (
                    <TableRow key={`sched-${apt.id}`}>
                      <TableCell>{format(new Date(apt.appointmentDate), "PPP p")}</TableCell>
                      <TableCell>{barberById.get(Number(apt.barberId))?.firstName ?? `#${apt.barberId}`}</TableCell>
                      <TableCell>{apt.guestFirstName ? `${apt.guestFirstName} ${apt.guestLastName ?? ""}` : "Registered Client"}</TableCell>
                      <TableCell className="capitalize">{apt.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>

            <div className="bg-white border border-amber-100 rounded-xl p-5 overflow-x-auto">
              <h3 className="text-xl font-semibold mb-4">Timetable Graph View</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-36">Day</TableHead>
                    {timetableSlots.map((slot) => (
                      <TableHead key={slot} className="min-w-40">{slot}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timetableDays.map((day) => (
                    <TableRow key={day.key}>
                      <TableCell className="font-semibold">{day.label}</TableCell>
                      {timetableSlots.map((slot) => {
                        const items = timetableMap.get(`${day.key}|${slot}`) ?? [];
                        return (
                          <TableCell key={`${day.key}-${slot}`}>
                            {items.length === 0 ? (
                              <span className="text-zinc-400">-</span>
                            ) : (
                              <div className="space-y-1">
                                {items.map((it) => (
                                  <div key={`graph-${day.key}-${slot}-${it.id}`} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs">
                                    <p className="font-semibold">{barberById.get(Number(it.barberId))?.firstName ?? `#${it.barberId}`}</p>
                                    <p>{it.guestFirstName ? `${it.guestFirstName} ${it.guestLastName ?? ""}` : "Client"}</p>
                                    <p className="uppercase tracking-wide text-zinc-500">{it.status}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="barbers" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white border border-amber-100 rounded-xl p-5">
                <h3 className="text-xl font-semibold mb-4">Manage Branches</h3>
                <form onSubmit={handleCreateBranch} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                  <Input placeholder="Branch name" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} required />
                  <Input placeholder="Location" value={newBranch.location} onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })} required />
                  <Button type="submit" disabled={createBranch.isPending}><Plus className="w-4 h-4 mr-1" /> Add Branch</Button>
                </form>
                <div className="space-y-2">
                  {branches?.map((b) => (
                    <div key={b.id} className="flex items-center justify-between border rounded-md p-3">
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-sm text-zinc-500">{b.location}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => deleteBranch.mutate(b.id)} disabled={deleteBranch.isPending}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-amber-100 rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Create Barber</h3>
                </div>
                <form onSubmit={handleCreateBarber} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="First name" value={newBarber.firstName} onChange={(e) => setNewBarber({ ...newBarber, firstName: e.target.value })} required />
                    <Input placeholder="Last name" value={newBarber.lastName} onChange={(e) => setNewBarber({ ...newBarber, lastName: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Username" value={newBarber.username} onChange={(e) => setNewBarber({ ...newBarber, username: e.target.value })} required />
                    <Input type="password" placeholder="Password" value={newBarber.password} onChange={(e) => setNewBarber({ ...newBarber, password: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Email" value={newBarber.email} onChange={(e) => setNewBarber({ ...newBarber, email: e.target.value })} />
                    <Input placeholder="Phone" value={newBarber.phone} onChange={(e) => setNewBarber({ ...newBarber, phone: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={newBarber.branchId} onValueChange={(v) => setNewBarber({ ...newBarber, branchId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>
                        {branches?.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Years exp" value={newBarber.yearsOfExperience} onChange={(e) => setNewBarber({ ...newBarber, yearsOfExperience: e.target.value })} />
                  </div>
                  <Input placeholder="Bio" value={newBarber.bio} onChange={(e) => setNewBarber({ ...newBarber, bio: e.target.value })} />
                  <Button type="submit" className="w-full" disabled={createBarber.isPending}>
                    {createBarber.isPending ? "Creating..." : "Create Barber"}
                  </Button>
                </form>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {barbers?.filter((b) => b.role === "barber").map((barber) => (
                <Card key={barber.id} className="bg-white border-amber-100">
                  <CardHeader>
                    <CardTitle>{barber.firstName} {barber.lastName}</CardTitle>
                    <p className="text-sm text-zinc-500">@{barber.username}</p>
                    <p className="text-sm text-zinc-500">{barber.yearsOfExperience ?? 0} years experience</p>
                    <p className="text-sm text-zinc-500">Branch: {branchById.get(barber.branchId ?? -1)?.name ?? "Not assigned"}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditingBarber(barber)}>
                      <Pencil className="w-3 h-3 mr-2" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 border-red-500 text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        if (!window.confirm(`Delete barber ${barber.firstName} ${barber.lastName}?`)) return;
                        try {
                          await deleteBarber.mutateAsync(barber.id);
                          toast({ title: "Barber deleted" });
                        } catch (err: any) {
                          toast({ variant: "destructive", title: "Delete failed", description: err.message });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-2" /> Delete
                    </Button>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <div className="flex justify-between items-center bg-white border border-amber-100 rounded-xl p-5">
              <h3 className="text-xl font-semibold">Manage Services</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> Add Service</Button>
                </DialogTrigger>
                <DialogContent className="bg-white border-zinc-200 text-zinc-900">
                  <DialogHeader><DialogTitle>Add New Service</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateService} className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Service Name</Label><Input value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Price</Label><Input type="number" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} required /></div>
                      <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" value={newService.durationMinutes} onChange={(e) => setNewService({ ...newService, durationMinutes: e.target.value })} required /></div>
                    </div>
                    <Button type="submit" className="w-full" disabled={createService.isPending}>
                      {createService.isPending ? "Saving..." : "Save Service"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {services?.map((service) => (
                <Card key={service.id} className="bg-white border-amber-100">
                  <CardHeader>
                    <CardTitle>{service.name}</CardTitle>
                    <p className="text-2xl font-semibold">${service.price}</p>
                    <p className="text-sm text-zinc-500">{service.durationMinutes} mins</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditingService(service)}>
                      <Pencil className="w-3 h-3 mr-2" /> Edit
                    </Button>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <div className="bg-white border border-amber-100 rounded-xl p-5">
              <h3 className="text-xl font-semibold mb-4">Barber Performance Report</h3>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barber</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {barberReports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell>{r.pending}</TableCell>
                      <TableCell>{r.accepted}</TableCell>
                      <TableCell>{r.completed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-6">
            <div className="rounded-xl border border-amber-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">Landing Gallery Manager</h3>
                <Button size="sm" onClick={() => void handleSaveLandingMedia()} disabled={saveLandingMedia.isPending || landingMediaProcessing > 0}>
                  {landingMediaProcessing > 0 ? "Processing files..." : saveLandingMedia.isPending ? "Saving..." : "Save Gallery"}
                </Button>
              </div>
              <p className="text-sm text-zinc-600">Upload content for Landing page Photo Boxes and Video Boxes.</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Photo Boxes</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLandingPhotos((prev) => [...prev, { id: String(Date.now()), title: "New Photo", imageUrl: "" }])}
                >
                  Add Photo Box
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {landingPhotos.map((p, idx) => (
                  <div key={p.id} className="rounded-lg border border-zinc-200 p-3 space-y-2">
                    <Input
                      value={p.title}
                      onChange={(e) => setLandingPhotos((prev) => prev.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item)))}
                      placeholder="Photo title"
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLandingMediaProcessing((v) => v + 1);
                        void (async () => {
                          try {
                            const dataUrl = await readImageAsCompressedDataUrl(file);
                            setLandingPhotos((prev) => prev.map((item, i) => (i === idx ? { ...item, imageUrl: dataUrl } : item)));
                          } finally {
                            setLandingMediaProcessing((v) => Math.max(0, v - 1));
                          }
                        })();
                      }}
                    />
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="h-24 w-full object-cover rounded border" /> : <div className="h-24 rounded border border-dashed flex items-center justify-center text-xs text-zinc-500">No image</div>}
                    <Button size="sm" variant="destructive" onClick={() => setLandingPhotos((prev) => prev.filter((_, i) => i !== idx))}>Delete</Button>
                  </div>
                ))}
                {landingPhotos.length === 0 ? <p className="text-sm text-zinc-500">No photo boxes yet.</p> : null}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold flex items-center gap-2"><Video className="h-4 w-4" /> Video Boxes</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLandingVideos((prev) => [...prev, { id: String(Date.now()), title: "New Video", videoUrl: "" }])}
                >
                  Add Video Box
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {landingVideos.map((v, idx) => (
                  <div key={v.id} className="rounded-lg border border-zinc-200 p-3 space-y-2">
                    <Input
                      value={v.title}
                      onChange={(e) => setLandingVideos((prev) => prev.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item)))}
                      placeholder="Video title"
                    />
                    <Input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 8 * 1024 * 1024) {
                          toast({ variant: "destructive", title: "Video too large", description: "Use a video file under 8MB." });
                          return;
                        }
                        setLandingMediaProcessing((v) => v + 1);
                        void (async () => {
                          try {
                            const dataUrl = await readFileAsDataUrl(file);
                            setLandingVideos((prev) => prev.map((item, i) => (i === idx ? { ...item, videoUrl: dataUrl } : item)));
                          } finally {
                            setLandingMediaProcessing((v) => Math.max(0, v - 1));
                          }
                        })();
                      }}
                    />
                    {v.videoUrl ? <video controls className="h-24 w-full object-cover rounded border" src={v.videoUrl} /> : <div className="h-24 rounded border border-dashed flex items-center justify-center text-xs text-zinc-500">No video</div>}
                    <Button size="sm" variant="destructive" onClick={() => setLandingVideos((prev) => prev.filter((_, i) => i !== idx))}>Delete</Button>
                  </div>
                ))}
                {landingVideos.length === 0 ? <p className="text-sm text-zinc-500">No video boxes yet.</p> : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {canAccess("manage_admins") && (
              <>
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                  <h3 className="text-lg font-semibold mb-3">Create Sub-Admin</h3>
                  <form onSubmit={handleCreateAdmin} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input placeholder="Username" value={newAdminForm.username} onChange={(e) => setNewAdminForm((p) => ({ ...p, username: e.target.value }))} required />
                      <Input type="password" placeholder="Password" value={newAdminForm.password} onChange={(e) => setNewAdminForm((p) => ({ ...p, password: e.target.value }))} required />
                      <Input placeholder="First Name" value={newAdminForm.firstName} onChange={(e) => setNewAdminForm((p) => ({ ...p, firstName: e.target.value }))} required />
                      <Input placeholder="Last Name" value={newAdminForm.lastName} onChange={(e) => setNewAdminForm((p) => ({ ...p, lastName: e.target.value }))} required />
                      <Input placeholder="Email (optional)" value={newAdminForm.email} onChange={(e) => setNewAdminForm((p) => ({ ...p, email: e.target.value }))} />
                      <Input placeholder="Phone (optional)" value={newAdminForm.phone} onChange={(e) => setNewAdminForm((p) => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                      <p className="text-sm font-medium mb-2">Select dashboard access</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {ADMIN_MODULE_OPTIONS.map((m) => (
                          <label key={`new-admin-perm-${m.key}`} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={newAdminPermissions.includes(m.key)}
                              onChange={(e) =>
                                setNewAdminPermissions((prev) =>
                                  e.target.checked ? [...prev, m.key] : prev.filter((v) => v !== m.key),
                                )
                              }
                            />
                            <span>{m.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-zinc-600">Tip: leaving all unchecked means full access.</p>
                    </div>
                    <Button type="submit">Create Admin</Button>
                  </form>
                </div>

                <div className="rounded-xl border border-emerald-300 bg-white p-4 space-y-3">
                  <h3 className="text-lg font-semibold">Admin Access Control</h3>
                  {(adminUsers ?? []).filter((u) => u.role === "admin").map((u) => (
                    <div key={`admin-perm-row-${u.id}`} className="rounded-lg border border-zinc-200 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="font-medium">{u.firstName} {u.lastName} (@{u.username || "-"})</p>
                        <Button size="sm" onClick={() => void handleSaveAdminPermissions(Number(u.id))}>Save Access</Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {ADMIN_MODULE_OPTIONS.map((m) => (
                          <label key={`admin-${u.id}-perm-${m.key}`} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={(editingAdminPermissionsById[Number(u.id)] ?? []).includes(m.key)}
                              onChange={(e) =>
                                setEditingAdminPermissionsById((prev) => {
                                  const existing = prev[Number(u.id)] ?? [];
                                  const next = e.target.checked ? [...existing, m.key] : existing.filter((v) => v !== m.key);
                                  return { ...prev, [Number(u.id)]: next };
                                })
                              }
                              disabled={Number(u.id) === Number(user.id)}
                            />
                            <span>{m.label}</span>
                          </label>
                        ))}
                      </div>
                      {Number(u.id) === Number(user.id) ? <p className="text-xs text-zinc-500 mt-2">You cannot change your own access from this account.</p> : null}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="rounded-xl border border-blue-300 bg-blue-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-blue-900">Admin users list</p>
                <Select value={userViewType} onValueChange={(v) => setUserViewType(v as "all" | "barber" | "client")}>
                  <SelectTrigger className="w-44 bg-white">
                    <SelectValue placeholder="Filter role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="barber">Barbers</SelectItem>
                    <SelectItem value="client">Clients</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => void loadAdminUsers(userViewType)}>
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportCsv(
                      `users-${userViewType}.csv`,
                      adminUsers.map((u) => ({
                        id: u.id,
                        role: u.role,
                        username: u.username ?? "",
                        passwordHash: u.passwordHash ?? "",
                        firstName: u.firstName ?? "",
                        lastName: u.lastName ?? "",
                        email: u.email ?? "",
                        phone: u.phone ?? "",
                        authProvider: u.authProvider ?? "",
                        emailVerified: String(Boolean(u.emailVerified)),
                        branchId: u.branchId ?? "",
                        reservationCount: u.reservationCount ?? 0,
                      })),
                    )
                  }
                >
                  Export CSV
                </Button>
              </div>
              {adminUsersNote ? <p className="text-xs text-blue-700 mt-2">{adminUsersNote}</p> : null}
            </div>

            <div className="rounded-xl border border-blue-300 bg-white p-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Password / Hash</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Email Verified</TableHead>
                      <TableHead>Reservations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-zinc-500">Loading users...</TableCell>
                      </TableRow>
                    ) : adminUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-zinc-500">No users found.</TableCell>
                      </TableRow>
                    ) : (
                      adminUsers.map((u) => (
                        <TableRow key={`admin-user-${u.id}`}>
                          <TableCell>{u.id}</TableCell>
                          <TableCell className="uppercase">{u.role}</TableCell>
                          <TableCell>{u.username || "-"}</TableCell>
                          <TableCell className="max-w-[280px] break-all text-xs text-zinc-600">{u.passwordHash || "-"}</TableCell>
                          <TableCell>{`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "-"}</TableCell>
                          <TableCell>{u.email || "-"}</TableCell>
                          <TableCell>{u.phone || "-"}</TableCell>
                          <TableCell>{u.authProvider || "-"}</TableCell>
                          <TableCell>{u.emailVerified ? "yes" : "no"}</TableCell>
                          <TableCell>{u.reservationCount ?? 0}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="developer" className="space-y-6">
            <div className="bg-[#1a1b1e] border border-zinc-700 rounded-lg p-4 text-zinc-100">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">Developer Dashboard</p>
                <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-100 hover:bg-zinc-700" onClick={() => void loadDeveloperSnapshot()}>
                  Refresh
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-100 hover:bg-zinc-700" onClick={() => void exportDeveloperData()}>
                  Export JSON
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-100 hover:bg-zinc-700" onClick={() => void exportSchemaJson()}>
                  Export Schema
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-100 hover:bg-zinc-700" onClick={() => void exportDeveloperSqlTemplate()}>
                  Export SQL
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-100 hover:bg-zinc-700" onClick={() => { void loadDeveloperSchema(); void loadDeveloperSqlReport(); }}>
                  Load SQL Reports
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    className="w-60 bg-zinc-900 border-zinc-600 text-zinc-100"
                    placeholder="Search logs/path/user..."
                    value={developerSearch}
                    onChange={(e) => setDeveloperSearch(e.target.value)}
                  />
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={developerAutoRefresh}
                      onChange={(e) => setDeveloperAutoRefresh(e.target.checked)}
                    />
                    Auto refresh 15s
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1b1e] border border-zinc-700 rounded-lg p-4 text-zinc-100 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">Change Admin Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Select
                  value={passwordTargetAdminId}
                  onValueChange={(value) => {
                    setPasswordTargetAdminId(value);
                    const selected = developerAdmins.find((u) => String(u.id) === value);
                    setPasswordTargetUsername(selected?.username ?? "");
                  }}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100">
                    <SelectValue placeholder="Select admin" />
                  </SelectTrigger>
                  <SelectContent>
                    {(developerAdmins ?? []).map((u) => (
                      <SelectItem key={`pwd-admin-${u.id}`} value={String(u.id)}>
                        {u.firstName} {u.lastName} (@{u.username || "-"}){u.isMainAdmin ? " [Main]" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="bg-zinc-900 border-zinc-700 text-zinc-100"
                  value={passwordTargetUsername}
                  onChange={(e) => setPasswordTargetUsername(e.target.value)}
                  placeholder="New username (optional)"
                />
                <Input
                  type="password"
                  className="bg-zinc-900 border-zinc-700 text-zinc-100"
                  value={passwordTargetValue}
                  onChange={(e) => setPasswordTargetValue(e.target.value)}
                  placeholder="New password (min 6)"
                />
                <Button onClick={() => void handleChangeAdminPassword()}>Save Credentials</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Problems</p>
                <p className="text-4xl font-bold text-red-500">{(developerSnapshot?.authAndSecurity?.vulnerabilities ?? []).length}</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Security score</p>
                <p className="text-3xl font-bold text-blue-400">{developerSnapshot?.authAndSecurity?.securityScore ?? 0}%</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Database</p>
                <p className="text-lg font-semibold">{developerSnapshot?.network?.dbStatus ?? "-"}</p>
                <p className="text-xs text-zinc-400">{developerSnapshot?.network?.dbLatencyMs ?? "-"} ms</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Routes</p>
                <p className="text-3xl font-bold">{developerSnapshot?.counts?.routes ?? 0}</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Users</p>
                <p className="text-3xl font-bold">{developerSnapshot?.counts?.users ?? 0}</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Appointments</p>
                <p className="text-3xl font-bold">{developerSnapshot?.counts?.appointments ?? 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Host / Port</p>
                <p className="text-sm font-semibold">{developerSnapshot?.app?.host ?? "-"}:{developerSnapshot?.app?.port ?? "-"}</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">Domain</p>
                <p className="text-sm font-semibold">{developerSnapshot?.network?.domain ?? "-"}</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">SSL</p>
                <p className="text-sm font-semibold">{developerSnapshot?.network?.sslEnabled ? "enabled" : "disabled"}</p>
                <p className="text-xs text-zinc-400">cert: {String(Boolean(developerSnapshot?.network?.sslCertConfigured))} | key: {String(Boolean(developerSnapshot?.network?.sslKeyConfigured))}</p>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <p className="text-sm text-zinc-400">IP Bind</p>
                <p className="text-xs font-semibold break-all">{(developerSnapshot?.network?.bindIps ?? []).join(", ") || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <h3 className="text-sm font-semibold mb-2 text-zinc-300">Security / Vulnerabilities</h3>
                {developerLoading ? (
                  <p className="text-sm text-zinc-400">Loading snapshot...</p>
                ) : (
                  <>
                    <p className="text-sm">Auth: <strong>{developerSnapshot?.authAndSecurity?.mode ?? "-"}</strong> | JWT: <strong>{String(developerSnapshot?.authAndSecurity?.jwtEnabled ?? false)}</strong></p>
                    <p className="text-sm">Firewall: <strong>{developerSnapshot?.authAndSecurity?.firewall ?? "-"}</strong></p>
                    <ul className="mt-2 text-sm list-disc pl-5 text-zinc-300">
                      {(developerSnapshot?.authAndSecurity?.vulnerabilities ?? []).length === 0 ? (
                        <li>No vulnerability flags from runtime checks.</li>
                      ) : (
                        (developerSnapshot?.authAndSecurity?.vulnerabilities ?? []).map((v: string, idx: number) => (
                          <li key={`vuln-${idx}`}>{v}</li>
                        ))
                      )}
                    </ul>
                  </>
                )}
              </div>

              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <h3 className="text-sm font-semibold mb-2 text-zinc-300">Login / Auth History</h3>
                <div className="max-h-72 overflow-auto text-xs bg-[#1e1f23] border border-zinc-700 rounded p-2">
                  <pre>
                    {JSON.stringify(
                      (developerSnapshot?.loginHistory ?? []).filter((l: any) => {
                        if (!developerSearch.trim()) return true;
                        const s = JSON.stringify(l).toLowerCase();
                        return s.includes(developerSearch.toLowerCase());
                      }).slice(0, 120),
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>

              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <h3 className="text-sm font-semibold mb-2 text-zinc-300">API Calls / Network Status</h3>
                <div className="max-h-72 overflow-auto text-xs bg-[#1e1f23] border border-zinc-700 rounded p-2">
                  <pre>
                    {JSON.stringify(
                      (developerSnapshot?.recentApiCalls ?? []).filter((l: any) => {
                        if (!developerSearch.trim()) return true;
                        const s = JSON.stringify(l).toLowerCase();
                        return s.includes(developerSearch.toLowerCase());
                      }).slice(0, 180),
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>

              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <h3 className="text-sm font-semibold mb-2 text-zinc-300">Reservation + Payment History</h3>
                <div className="max-h-72 overflow-auto text-xs bg-[#1e1f23] border border-zinc-700 rounded p-2">
                  <pre>
                    {JSON.stringify(
                      (developerSnapshot?.recentReservations ?? []).filter((l: any) => {
                        if (!developerSearch.trim()) return true;
                        const s = JSON.stringify(l).toLowerCase();
                        return s.includes(developerSearch.toLowerCase());
                      }).slice(0, 180),
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
              <h3 className="text-sm font-semibold mb-2 text-zinc-300">Registered API Routes</h3>
              <div className="max-h-56 overflow-auto text-xs bg-[#1e1f23] border border-zinc-700 rounded p-2">
                <pre>{JSON.stringify((developerSnapshot?.routes ?? []).slice(0, 500), null, 2)}</pre>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <h3 className="text-sm font-semibold mb-2 text-zinc-300">DB Schema Report</h3>
                <p className="text-xs text-zinc-400 mb-2">Tables: {developerSchema?.tablesCount ?? developerSnapshot?.dbSchema?.tablesCount ?? 0}</p>
                <div className="max-h-72 overflow-auto text-xs bg-[#1e1f23] border border-zinc-700 rounded p-2">
                  <pre>{JSON.stringify((developerSchema?.tables ?? developerSnapshot?.dbSchema?.tables ?? []).slice(0, 120), null, 2)}</pre>
                </div>
              </div>
              <div className="bg-[#2a2b2f] border border-zinc-700 rounded-lg p-4 text-zinc-100">
                <h3 className="text-sm font-semibold mb-2 text-zinc-300">SQL Monitoring Report</h3>
                <p className="text-xs text-zinc-400 mb-2">Duration buckets + top paths + slow calls</p>
                <div className="max-h-72 overflow-auto text-xs bg-[#1e1f23] border border-zinc-700 rounded p-2">
                  <pre>{JSON.stringify(developerSqlReport ?? developerSnapshot?.sqlMonitoring ?? {}, null, 2)}</pre>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="growth" className="space-y-6">
            <AdminAdvancedModules />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service details and save changes.</DialogDescription>
          </DialogHeader>
          {editingService && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editingService.name} onChange={(e) => setEditingService({ ...editingService, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input type="number" value={editingService.price} onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input type="number" value={editingService.durationMinutes} onChange={(e) => setEditingService({ ...editingService, durationMinutes: Number(e.target.value) })} />
                </div>
              </div>
              <Button className="w-full" onClick={handleSaveService} disabled={updateService.isPending}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBarber} onOpenChange={(open) => !open && setEditingBarber(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Barber</DialogTitle>
            <DialogDescription>Update barber profile and branch settings.</DialogDescription>
          </DialogHeader>
          {editingBarber && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={editingBarber.firstName} onChange={(e) => setEditingBarber({ ...editingBarber, firstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={editingBarber.lastName} onChange={(e) => setEditingBarber({ ...editingBarber, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editingBarber.email ?? ""} onChange={(e) => setEditingBarber({ ...editingBarber, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editingBarber.phone ?? ""} onChange={(e) => setEditingBarber({ ...editingBarber, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                  value={editingBarber.branchId ? String(editingBarber.branchId) : ""}
                  onValueChange={(v) => setEditingBarber({ ...editingBarber, branchId: Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches?.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Experience (years)</Label>
                <Input
                  type="number"
                  value={editingBarber.yearsOfExperience ?? 0}
                  onChange={(e) => setEditingBarber({ ...editingBarber, yearsOfExperience: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>New Password (optional)</Label>
                <Input type="password" value={editingBarberPassword} onChange={(e) => setEditingBarberPassword(e.target.value)} placeholder="Leave empty to keep current password" />
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Input value={editingBarber.bio ?? ""} onChange={(e) => setEditingBarber({ ...editingBarber, bio: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleSaveBarber} disabled={updateBarber.isPending}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAppointment} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Contact Info</DialogTitle>
            <DialogDescription>Send a message to this client by available channels.</DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-3">
              <p><strong>Client:</strong> {selectedAppointment.guestFirstName ? `${selectedAppointment.guestFirstName} ${selectedAppointment.guestLastName ?? ""}` : "Registered Client"}</p>
              <p><strong>Email:</strong> {selectedAppointment.guestEmail || "N/A"}</p>
              <p><strong>Phone:</strong> {selectedAppointment.guestPhone || "N/A"}</p>
              <div className="space-y-2">
                <Label>Send message (SMS + Email when configured)</Label>
                <Textarea value={adminMessageText} onChange={(e) => setAdminMessageText(e.target.value)} rows={4} placeholder="Type your message..." />
              </div>
              <Button className="w-full" disabled={sendAdminMessage.isPending || !adminMessageText.trim()} onClick={handleSendAppointmentMessage}>
                {sendAdminMessage.isPending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
