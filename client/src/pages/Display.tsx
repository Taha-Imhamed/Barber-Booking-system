import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Clock, CloudSun } from "lucide-react";
import { useAppointments } from "@/hooks/use-appointments";

export default function Display() {
  const [time, setTime] = useState(new Date());
  const { data: appointments } = useAppointments();
  
  const pendingAppointments = appointments?.filter(a => a.status === 'pending') || [];
  const previousPendingCount = useRef(0);

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Notification chime on new pending appointment
  useEffect(() => {
    if (pendingAppointments.length > previousPendingCount.current) {
      try {
        // Mock audio URL for chime
        const audio = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3');
        audio.play().catch(e => console.log("Audio play prevented by browser policy", e));
      } catch (e) {
        console.error(e);
      }
    }
    previousPendingCount.current = pendingAppointments.length;
  }, [pendingAppointments.length]);

  return (
    <div className="min-h-screen bg-zinc-950 overflow-hidden relative font-sans text-zinc-100 flex flex-col">
      {/* Background aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[120px]"></div>
        {/* luxury dark texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-8 lg:p-12 max-w-[100vw] mx-auto w-full">
        
        {/* Top Header Row */}
        <div className="flex justify-between items-start w-full">
          {/* Weather Widget */}
          <div className="flex items-center gap-4 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 px-6 py-4 rounded-2xl shadow-xl">
            <CloudSun className="w-10 h-10 text-amber-500" />
            <div>
              <p className="text-2xl font-bold tracking-tight">24°C</p>
              <p className="text-zinc-400 font-medium tracking-wide">Sunny • Tirana</p>
            </div>
          </div>
          
          {/* Logo */}
          <div className="text-center bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 px-8 py-4 rounded-2xl shadow-xl">
            <h1 className="font-display text-4xl font-bold tracking-widest text-white uppercase">
              BLADE <span className="text-amber-500 font-sans font-light">&</span> CO
            </h1>
            <p className="text-zinc-500 text-sm tracking-[0.2em] mt-1">EST. 2024</p>
          </div>
        </div>

        {/* Center Clock */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-12">
          <div className="flex items-center gap-6 mb-4 text-amber-500">
            <Clock className="w-8 h-8" />
            <h2 className="text-3xl font-light tracking-widest uppercase">{format(time, "EEEE, MMMM do")}</h2>
          </div>
          <div className="text-[12rem] font-display font-bold leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500 drop-shadow-2xl">
            {format(time, "HH:mm")}
          </div>
          <p className="text-6xl font-light text-zinc-600 mt-[-2rem]">{format(time, "ss")}</p>
        </div>

        {/* Bottom Waitlist Box */}
        <div className="w-full max-w-3xl mx-auto bg-zinc-900/60 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
          
          <div className="flex justify-between items-end mb-6 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-2xl font-display font-bold text-white flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                Waiting List
              </h3>
              <p className="text-zinc-400 mt-1">Orders waiting to be accepted</p>
            </div>
            <div className="text-4xl font-bold text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl">
              {pendingAppointments.length}
            </div>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-hidden relative">
            {pendingAppointments.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 font-medium text-lg">
                No pending orders right now. Shop is clear!
              </div>
            ) : (
              <div className="grid gap-3">
                {pendingAppointments.slice(0, 4).map((apt, i) => (
                  <div key={apt.id} className="flex justify-between items-center p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 animate-in slide-in-from-right-4 fade-in duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xl border border-amber-500/30">
                        {(apt.guestFirstName?.[0] || 'G')}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{apt.guestFirstName || 'Guest'} {apt.guestLastName || ''}</p>
                        <p className="text-zinc-400 text-sm">Requested at {format(new Date(apt.createdAt || new Date()), "HH:mm")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-500 font-medium">Service #{apt.serviceId}</p>
                      <p className="text-zinc-400 text-sm font-mono">{format(new Date(apt.appointmentDate), "HH:mm")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingAppointments.length > 4 && (
              <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-zinc-900/90 to-transparent flex items-end justify-center pb-2">
                <span className="text-amber-500 font-bold text-sm bg-zinc-900 px-4 py-1 rounded-full border border-zinc-800">
                  +{pendingAppointments.length - 4} more waiting
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
