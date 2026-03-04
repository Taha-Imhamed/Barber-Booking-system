import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Clock, CloudSun } from "lucide-react";
import { useAppointments } from "@/hooks/use-appointments";
import { playNotificationTone } from "@/lib/playNotificationTone";
import { Link } from "wouter";
import { usePublicSettings } from "@/hooks/use-settings";

const DEFAULT_WALL_BG = "https://www.baltana.com/files/wallpapers-29/Istanbul-Wallpaper-95987.jpg";

export default function Display() {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: string; label: string }>({
    temp: "--",
    label: "Loading...",
  });
  const { data: appointments } = useAppointments();
  const { data: settings } = usePublicSettings();

  const pendingAppointments = appointments?.filter((a) => a.status === "pending") || [];
  const previousPendingCount = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchWeather() {
      try {
        // Istanbul coordinates
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=41.0082&longitude=28.9784&current=temperature_2m,weather_code",
        );
        if (!res.ok) return;
        const json = await res.json();
        const temp = Math.round(json.current?.temperature_2m ?? 0);
        const code = Number(json.current?.weather_code ?? 0);
        const label = code < 3 ? "Clear" : code < 60 ? "Cloudy" : "Rain";
        setWeather({ temp: `${temp}C`, label: `${label} - Istanbul` });
      } catch {
        setWeather({ temp: "--", label: "Istanbul" });
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pendingAppointments.length > previousPendingCount.current) {
      playNotificationTone();
    }
    previousPendingCount.current = pendingAppointments.length;
  }, [pendingAppointments.length]);

  return (
    <div className="min-h-screen overflow-hidden relative text-zinc-50 flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${settings?.wallDisplayBackground || DEFAULT_WALL_BG}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/55 to-black/75" />

      <div className="relative z-10 flex-1 flex flex-col p-6 lg:p-10 max-w-[110rem] mx-auto w-full">
        <div className="flex justify-between items-start w-full gap-4">
          {settings?.wallShowWeather !== false && (
          <div className="flex items-center gap-3 bg-black/25 backdrop-blur-xl border border-white/15 px-5 py-3 rounded-2xl">
            <CloudSun className="w-8 h-8 text-amber-300" />
            <div>
              <p className="text-xl font-bold">{weather.temp}</p>
              <p className="text-zinc-200 text-sm">{weather.label}</p>
            </div>
          </div>
          )}

          <div className="text-center bg-black/25 backdrop-blur-xl border border-white/15 px-7 py-3 rounded-2xl">
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[0.18em] uppercase">
              Istanbul Salon
            </h1>
            <p className="text-zinc-200 text-xs tracking-[0.3em] mt-1">Live Wall Display</p>
          </div>
          <Link href="/" className="bg-black/25 backdrop-blur-xl border border-white/15 px-4 py-2 rounded-xl text-sm hover:bg-black/40 transition-colors">
            Back Home
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-3 text-amber-200">
            <Clock className="w-7 h-7" />
            <h2 className="text-xl md:text-2xl tracking-widest uppercase">{format(time, "EEEE, MMMM do")}</h2>
          </div>
          <div className="rounded-3xl border border-white/20 bg-black/30 backdrop-blur-xl px-8 py-5 shadow-2xl">
            <div className="text-[5rem] md:text-[9rem] font-display font-bold leading-none tracking-tight">
              {format(time, "HH:mm")}
            </div>
          </div>
          <p className="text-3xl md:text-5xl text-amber-200 mt-3 tracking-wider">{format(time, "ss")}</p>
        </div>

        <div className="w-full max-w-5xl mx-auto bg-black/35 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex justify-between items-end mb-6 border-b border-white/15 pb-4">
            <div>
              <h3 className="text-2xl font-display font-bold flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-amber-300 animate-pulse" />
                Current Queue
              </h3>
              <p className="text-zinc-200 mt-1 text-sm">Real-time booking status</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-[0.2em]">Waiting</span>
              <div className="text-4xl font-bold text-amber-200">{pendingAppointments.length}</div>
            </div>
          </div>

          {pendingAppointments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-zinc-200 text-xl">No pending bookings right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingAppointments.slice(0, settings?.wallQueueLimit ?? 6).map((apt) => (
                <div key={apt.id} className="flex justify-between items-center p-4 rounded-xl bg-white/10 border border-white/15">
                  <div>
                    <p className="text-lg font-semibold">{apt.guestFirstName || "Guest"} {apt.guestLastName || ""}</p>
                    <p className="text-zinc-300 text-xs">Booked at {format(new Date(apt.createdAt || new Date()), "HH:mm")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-200 font-semibold">{format(new Date(apt.appointmentDate), "HH:mm")}</p>
                    <p className="text-zinc-300 text-xs uppercase tracking-wider">Pending</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {settings?.wallShowMusic !== false && (
        <div className="mt-4 ml-auto w-full max-w-sm bg-black/35 backdrop-blur-2xl border border-white/20 rounded-2xl p-3">
          <p className="text-xs uppercase tracking-widest text-zinc-200 mb-2">Wall Music</p>
          <iframe
            width="100%"
            height="90"
            src="https://www.youtube.com/embed/eW7gIbMswmo?autoplay=1"
            title="Wall music"
            allow="autoplay; encrypted-media"
          />
        </div>
        )}
      </div>
    </div>
  );
}
