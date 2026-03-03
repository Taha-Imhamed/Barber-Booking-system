import { useState } from "react";
import { useLocation } from "wouter";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const updateForm = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login({ username: formData.username, password: formData.password });
        toast({ title: "Welcome back!" });
        setLocation("/");
      } else {
        await register({ ...formData, role: 'client' });
        toast({ title: "Account created!", description: "You can now earn loyalty points." });
        setLocation("/");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Authentication failed.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <div className="bg-amber-500 p-3 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <Scissors className="w-8 h-8 text-zinc-950" />
          </div>
        </div>

        <Card className="bg-zinc-900/80 backdrop-blur-xl border-zinc-800 text-zinc-100 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-display text-amber-500">
              {isLogin ? "Sign In" : "Join the Club"}
            </CardTitle>
            <CardDescription className="text-zinc-400">
              {isLogin ? "Access your appointments & points" : "Create an account to earn loyalty points"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input className="bg-zinc-950 border-zinc-800" required value={formData.firstName} onChange={(e) => updateForm("firstName", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input className="bg-zinc-950 border-zinc-800" required value={formData.lastName} onChange={(e) => updateForm("lastName", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input className="bg-zinc-950 border-zinc-800" required type="tel" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input className="bg-zinc-950 border-zinc-800" required type="email" value={formData.email} onChange={(e) => updateForm("email", e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Username</Label>
                <Input className="bg-zinc-950 border-zinc-800" required value={formData.username} onChange={(e) => updateForm("username", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input className="bg-zinc-950 border-zinc-800" required type="password" value={formData.password} onChange={(e) => updateForm("password", e.target.value)} />
              </div>

              <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold mt-6" disabled={isLoggingIn || isRegistering}>
                {isLoggingIn || isRegistering ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
              </Button>

              <div className="text-center mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsLogin(!isLogin)} 
                  className="text-sm text-zinc-400 hover:text-amber-500 transition-colors"
                >
                  {isLogin ? "Don't have an account? Register" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
