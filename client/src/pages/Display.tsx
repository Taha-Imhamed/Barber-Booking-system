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
        // Different sound: Modern notification chime
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log("Audio play prevented by browser policy", e));
      } catch (e) {
        console.error(e);
      }
    }
    previousPendingCount.current = pendingAppointments.length;
  }, [pendingAppointments.length]);

  return (
    <div className="min-h-screen bg-white overflow-hidden relative font-sans text-zinc-900 flex flex-col">
      {/* Background aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]"></div>
        {/* light texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-8 lg:p-12 max-w-[100vw] mx-auto w-full">
        
        {/* Top Header Row */}
        <div className="flex justify-between items-start w-full">
          {/* Weather Widget */}
          <div className="flex items-center gap-4 bg-white/80 backdrop-blur-xl border border-zinc-200 px-6 py-4 rounded-2xl shadow-lg">
            <CloudSun className="w-10 h-10 text-amber-500" />
            <div>
              <p className="text-2xl font-bold tracking-tight text-zinc-900">24°C</p>
              <p className="text-zinc-500 font-medium tracking-wide">Sunny • Tirana</p>
            </div>
          </div>
          
          {/* Logo */}
          <div className="text-center bg-white/80 backdrop-blur-xl border border-zinc-200 px-8 py-4 rounded-2xl shadow-lg">
            <h1 className="font-display text-4xl font-bold tracking-widest text-zinc-900 uppercase">
              ISTANBUL <span className="text-amber-500 font-sans font-light">SALON</span>
            </h1>
            <p className="text-zinc-400 text-sm tracking-[0.2em] mt-1">EST. 2024</p>
          </div>
        </div>

        {/* Center Clock */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-12">
          <div className="flex items-center gap-6 mb-4 text-amber-500">
            <Clock className="w-8 h-8" />
            <h2 className="text-3xl font-light tracking-widest uppercase text-zinc-600">{format(time, "EEEE, MMMM do")}</h2>
          </div>
          <div className="text-[12rem] font-display font-bold leading-none tracking-tighter text-zinc-900 drop-shadow-sm">
            {format(time, "HH:mm")}
          </div>
          <p className="text-6xl font-light text-zinc-300 mt-[-2rem]">{format(time, "ss")}</p>
        </div>

        {/* Bottom Waitlist Box */}
        <div className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-2xl border border-zinc-200 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
          
          <div className="flex justify-between items-end mb-8 border-b border-zinc-100 pb-6">
            <div>
              <h3 className="text-3xl font-display font-bold text-zinc-900 flex items-center gap-4">
                <span className="w-4 h-4 rounded-full bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]"></span>
                Current Queue
              </h3>
              <p className="text-zinc-500 mt-1 font-medium text-lg">Real-time booking status</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-1">Waiting</span>
              <div className="text-5xl font-bold text-amber-500 bg-amber-50 px-6 py-2 rounded-2xl border border-amber-100">
                {pendingAppointments.length}
              </div>
            </div>
          </div>

          <div className="space-y-4 max-h-[350px] overflow-hidden relative">
            {pendingAppointments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Clock className="w-10 h-10 text-zinc-200" />
                </div>
                <p className="text-zinc-400 font-medium text-xl">No pending orders. Next seat available!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingAppointments.slice(0, 6).map((apt, i) => (
                  <div key={apt.id} className="flex justify-between items-center p-5 rounded-2xl bg-zinc-50/50 border border-zinc-100 animate-in slide-in-from-bottom-4 fade-in duration-500 shadow-sm" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white text-amber-500 flex items-center justify-center font-bold text-2xl border border-zinc-100 shadow-sm">
                        {(apt.guestFirstName?.[0] || 'G')}
                      </div>
                      <div>
                        <p className="text-xl font-bold text-zinc-900">{apt.guestFirstName || 'Guest'} {apt.guestLastName || ''}</p>
                        <p className="text-zinc-500 text-sm font-medium">Wait: {format(new Date(apt.createdAt || new Date()), "HH:mm")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-600 font-bold text-lg">Ready</p>
                      <p className="text-zinc-400 text-sm font-mono font-bold tracking-tighter">{format(new Date(apt.appointmentDate), "HH:mm")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingAppointments.length > 6 && (
              <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent flex items-end justify-center pb-2">
                <span className="text-amber-600 font-bold text-base bg-white px-6 py-2 rounded-full border border-zinc-100 shadow-lg">
                  +{pendingAppointments.length - 6} more clients in queue
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  );
}
