import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, Lock, Mail, Moon, Phone, Scissors, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { useTheme } from "@/hooks/use-theme";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.5 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.2-.1-1.7H12z" />
      <path fill="#34A853" d="M3.5 7.5l3.2 2.4C7.6 7.6 9.6 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.5 2.4 12 2.4 8.3 2.4 5.1 4.5 3.5 7.5z" />
      <path fill="#FBBC05" d="M12 21.6c2.4 0 4.5-.8 6-2.2l-2.8-2.2c-.8.5-1.9.9-3.2.9-3.8 0-5.2-2.5-5.5-3.8l-3.2 2.5c1.6 3 4.8 4.8 8.7 4.8z" />
      <path fill="#4285F4" d="M21.1 12.3c0-.6-.1-1.2-.1-1.7H12v3.9h5.5c-.2 1.1-1 2.4-2.3 3.2l2.8 2.2c1.6-1.5 3.1-4.1 3.1-7.6z" />
    </svg>
  );
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, register, signInWithGoogle, resendVerificationEmail, isLoggingIn, isRegistering, isResendingVerification } = useAuth();
  const { t } = useI18n();
  const { themeMode, toggleTheme } = useTheme();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState<boolean>(() => localStorage.getItem("remember_username") === "1");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const updateForm = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.username.trim() || !formData.password.trim()) {
        throw new Error("Username and password are required.");
      }
      if (isLogin) {
        await login({ username: formData.username.trim(), password: formData.password.trim() });
        if (rememberUsername) {
          localStorage.setItem("remember_username", "1");
          localStorage.setItem("remembered_username", formData.username.trim());
        } else {
          localStorage.removeItem("remember_username");
          localStorage.removeItem("remembered_username");
        }
        toast({ title: "Welcome back" });
      } else {
        if (formData.password.trim().length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await register({ ...formData, username: formData.username.trim(), password: formData.password.trim(), role: "client" });
        toast({ title: "Account created", description: "Priority + loyalty enabled for your account." });
      }
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: error.message || "Try again.",
      });
    }
  };

  const handleResendVerification = async () => {
    if (!formData.email.trim()) {
      toast({ variant: "destructive", title: "Email required", description: "Enter your email first." });
      return;
    }
    try {
      const result = await resendVerificationEmail(formData.email.trim());
      toast({ title: "Verification", description: result.message });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Try again." });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verifyToken");
    if (!verifyToken) return;

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Verification failed");
        toast({ title: "Email verified", description: data.message });
      })
      .catch((err: any) => {
        toast({ variant: "destructive", title: "Verification failed", description: err.message || "Invalid link." });
      });
  }, [toast]);

  useEffect(() => {
    if (!rememberUsername) return;
    const saved = localStorage.getItem("remembered_username");
    if (saved) {
      setFormData((prev) => ({ ...prev, username: saved }));
    }
  }, [rememberUsername]);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-3 sm:p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zinc-900/5 dark:bg-orange-500/10 rounded-full blur-[110px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-zinc-900/5 dark:bg-sky-500/10 rounded-full blur-[110px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div />
          <div className="bg-zinc-900 dark:bg-zinc-100 p-3 rounded-2xl shadow-lg">
            <Scissors className="w-7 h-7 text-white dark:text-zinc-900" />
          </div>
          <Button type="button" variant="outline" size="icon" onClick={toggleTheme} title={`Theme: ${themeMode}`} className="border-zinc-300 dark:border-zinc-700">
            {themeMode === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>

        <Card className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{isLogin ? "Istanbul Salon Sign In" : "Create Account"}</CardTitle>
            <CardDescription className="text-zinc-500 dark:text-zinc-400">
              {isLogin ? "Manage your reservations and points" : "Get priority booking and loyalty rewards"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input required autoComplete="given-name" className="pl-9" value={formData.firstName} onChange={(e) => updateForm("firstName", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input required autoComplete="family-name" className="pl-9" value={formData.lastName} onChange={(e) => updateForm("lastName", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input required autoComplete="tel" type="tel" className="pl-9" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input required autoComplete="email" type="email" className="pl-9" value={formData.email} onChange={(e) => updateForm("email", e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Username</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input required autoComplete="username" className="pl-9" value={formData.username} onChange={(e) => updateForm("username", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => updateForm("password", e.target.value)}
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {isLogin && (
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <input type="checkbox" checked={rememberUsername} onChange={(e) => setRememberUsername(e.target.checked)} />
                  Remember username on this device
                </label>
              )}

              <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-semibold mt-2" disabled={isLoggingIn || isRegistering}>
                {isLoggingIn || isRegistering ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
              <Button type="button" variant="outline" className="w-full border-zinc-300 dark:border-zinc-700" onClick={signInWithGoogle}>
                <GoogleIcon />
                {t("googleSignIn")} (Clients only)
              </Button>
              {!isLogin && (
                <Button type="button" variant="ghost" className="w-full text-zinc-600" onClick={handleResendVerification} disabled={isResendingVerification}>
                  {isResendingVerification ? "Sending..." : "Resend verification email"}
                </Button>
              )}

              <div className="text-center pt-1">
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
                  {isLogin ? "Need an account? Register" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-5">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
            {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
