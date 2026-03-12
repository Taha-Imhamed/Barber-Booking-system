import { Link } from "wouter";
import { LogIn, LayoutDashboard, LogOut, Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/i18n";
import { useTheme } from "@/hooks/use-theme";

export function Navbar() {
  const { user, logout } = useAuth();
  const { data: notifications } = useNotifications(user?.id);
  const { lang, setLang, t } = useI18n();
  const { themeMode, toggleTheme } = useTheme();
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <nav className="sticky top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 sm:h-20 items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-zinc-900/5 border border-zinc-200 p-2 rounded-xl transition-transform group-hover:scale-105">
              <img src="/pic/logo.png" alt="Istanbul Salon" className="h-8 w-8 object-contain" />
            </div>
            <span className="font-display text-lg sm:text-2xl font-semibold text-zinc-900 tracking-tight">
              Istanbul<span className="text-zinc-500">Salon</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/#timetable" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors hidden md:block">
              {t("timetable")}
            </a>
            <Link href="/display" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors hidden md:block">
              {t("wallDisplay")}
            </Link>
            <select
              aria-label={t("language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as "en" | "tr" | "sq" | "it")}
              className="h-8 sm:h-9 w-[70px] sm:w-auto rounded-md border border-zinc-300 bg-white px-2 text-xs sm:text-sm text-zinc-700"
            >
              <option value="en">{t("english")}</option>
              <option value="tr">{t("turkish")}</option>
              <option value="sq">{t("albanian")}</option>
              <option value="it">{t("italian")}</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={`Theme: ${themeMode}`}
              onClick={toggleTheme}
              className="border-zinc-300 text-zinc-700 hover:bg-zinc-100 h-8 w-8 sm:h-9 sm:w-9"
            >
              {themeMode === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            {user ? (
              <div className="flex items-center gap-3 ml-2 pl-3 border-l border-zinc-200">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-zinc-900">{user.firstName}</p>
                  <p className="text-xs text-zinc-500">{user.loyaltyPoints ?? 0} pts</p>
                </div>

                <div className="relative hidden sm:flex items-center justify-center h-9 w-9 rounded-md border border-zinc-200 bg-zinc-50">
                  <Bell className="h-4 w-4 text-zinc-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-zinc-900 text-[10px] leading-4 text-white text-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>

                {user.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="border-zinc-300 hover:bg-zinc-100 text-zinc-700">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Admin
                    </Button>
                  </Link>
                )}
                {user.role === "barber" && (
                  <Link href="/barber">
                    <Button variant="outline" size="sm" className="border-zinc-300 hover:bg-zinc-100 text-zinc-700">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Barber
                    </Button>
                  </Link>
                )}
                {user.role === "client" && (
                  <Link href="/account">
                    <Button variant="outline" size="sm" className="border-zinc-300 hover:bg-zinc-100 text-zinc-700">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Account
                    </Button>
                  </Link>
                )}

                <Button variant="ghost" size="icon" onClick={() => logout()} className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold px-3 sm:px-6 h-9 sm:h-10">
                  <LogIn className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("signIn")}</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
