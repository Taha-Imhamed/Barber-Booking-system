import { Link } from "wouter";
import { Scissors, LogIn, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-amber-500 p-2 rounded-lg group-hover:scale-105 transition-transform">
              <Scissors className="w-6 h-6 text-zinc-950" />
            </div>
            <span className="font-display text-2xl font-bold text-white tracking-wide">
              BLADE <span className="text-amber-500 font-sans text-xl font-normal opacity-80">&</span> CO
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link href="/display" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden md:block">
              Wall Display
            </Link>
            
            {user ? (
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/10">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-white">{user.firstName}</p>
                  <p className="text-xs text-amber-500 flex items-center justify-end gap-1">
                    ★ {user.loyaltyPoints || 0} pts
                  </p>
                </div>
                
                {user.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="border-amber-500/30 hover:bg-amber-500/10 text-amber-500">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Admin
                    </Button>
                  </Link>
                )}
                {user.role === 'barber' && (
                  <Link href="/barber">
                    <Button variant="outline" size="sm" className="border-amber-500/30 hover:bg-amber-500/10 text-amber-500">
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                    </Button>
                  </Link>
                )}
                
                <Button variant="ghost" size="icon" onClick={() => logout()} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-6">
                  <LogIn className="w-4 h-4 mr-2" /> Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
