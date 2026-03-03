import { Link } from "wouter";
import { ReservationForm } from "@/components/ReservationForm";
import { Navbar } from "@/components/layout/Navbar";
import { useBarbers } from "@/hooks/use-barbers";

export default function Landing() {
  const { data: barbers } = useBarbers();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* landing page hero barbershop background */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1920&h=1080&fit=crop" 
            alt="Barbershop Background" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl md:text-7xl font-display font-bold text-white leading-tight">
                Refine Your <br/>
                <span className="text-amber-500 italic">Signature Look</span>
              </h1>
              <p className="text-lg md:text-xl text-zinc-400 max-w-lg font-light leading-relaxed">
                Experience premium grooming with our master barbers. Reserve your seat, earn loyalty points, and walk out with confidence.
              </p>
              
              <div className="flex items-center gap-4 text-sm font-medium text-zinc-300">
                <div className="flex -space-x-3">
                  {/* mockup avatars */}
                  <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop" className="w-10 h-10 rounded-full border-2 border-background" />
                  <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop" className="w-10 h-10 rounded-full border-2 border-background" />
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-xs">
                    5k+
                  </div>
                </div>
                <p>Happy Clients</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-1 bg-amber-500/20 blur-3xl rounded-[2rem]"></div>
              <ReservationForm />
            </div>
          </div>
        </div>
      </section>

      {/* Barbers Section */}
      <section className="py-24 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-display font-bold text-white">Meet Our Masters</h2>
            <div className="w-24 h-1 bg-amber-500 mx-auto rounded-full"></div>
            <p className="text-zinc-400 max-w-2xl mx-auto">Decades of combined experience dedicated to the craft of traditional and modern barbering.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {barbers?.filter(b => b.role === 'barber').map((barber) => (
              <div key={barber.id} className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-amber-500/50 transition-colors duration-300">
                <div className="aspect-[4/5] overflow-hidden">
                  <img 
                    src={barber.photoUrl || "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&h=800&fit=crop"} 
                    alt={`${barber.firstName} ${barber.lastName}`}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent flex flex-col justify-end p-6">
                  <h3 className="text-2xl font-display font-bold text-white group-hover:text-amber-500 transition-colors">{barber.firstName} {barber.lastName}</h3>
                  <p className="text-amber-500/80 font-medium">{barber.yearsOfExperience} Years Experience</p>
                  <p className="mt-2 text-zinc-400 text-sm line-clamp-2">{barber.bio || "Master barber specializing in classic cuts, hot towel shaves, and modern fades."}</p>
                </div>
              </div>
            ))}
            
            {/* Fallback mock cards if no barbers from API */}
            {(!barbers || barbers.length === 0) && (
              <>
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  <div className="aspect-[4/5] bg-zinc-800 animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 p-6 flex flex-col justify-end">
                    <div className="h-6 w-32 bg-zinc-800 rounded mb-2"></div>
                    <div className="h-4 w-24 bg-zinc-800 rounded"></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
