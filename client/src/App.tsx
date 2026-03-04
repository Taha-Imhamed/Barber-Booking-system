import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationWatcher } from "@/components/NotificationWatcher";
import { useEffect } from "react";
import { initNotificationAudio } from "@/lib/playNotificationTone";
import { I18nProvider } from "./i18n";

// Pages
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Display from "./pages/Display";
import AdminDashboard from "./pages/AdminDashboard";
import BarberDashboard from "./pages/BarberDashboard";
import ClientAccount from "./pages/ClientAccount";
import GuestCheck from "./pages/GuestCheck";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/display" component={Display} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/barber" component={BarberDashboard} />
      <Route path="/account" component={ClientAccount} />
      <Route path="/check" component={GuestCheck} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    initNotificationAudio();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("theme_mode");
    const mode = saved === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <NotificationWatcher />
          <Router />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
