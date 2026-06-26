import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Headset, ArrowLeft, ArrowRight } from "lucide-react";
import authDashboard from "@/assets/auth-dashboard.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Call Centre" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You're signed in.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: purple brand panel with floating illustration */}
      <aside
        className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden text-white"
        style={{ background: "linear-gradient(160deg, #5b21b6 0%, #4c1d95 60%, #3b0d80 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 size-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute top-10 -left-16 size-56 rounded-full bg-fuchsia-400/20" />
        <div className="absolute -bottom-28 -right-20 size-96 rounded-full bg-violet-300/20" />
        <div className="absolute bottom-24 right-10 size-24 rounded-full bg-indigo-300/30" />

        <div className="relative z-10 flex items-center gap-2">
          <div className="size-9 rounded-md bg-white/15 flex items-center justify-center backdrop-blur">
            <Headset className="size-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Call Centre</span>
        </div>

        <div className="relative z-10 flex-1 flex items-start justify-center pt-4">
          <img
            src={authDashboard}
            alt="Analytics dashboard illustration"
            width={896}
            height={768}
            className="w-[78%] max-w-md -rotate-3 rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] select-none pointer-events-none"
          />
        </div>

        <div className="relative z-10 space-y-6 max-w-md mx-auto text-center">
          <p className="text-sm leading-relaxed text-white/80">
            Track every call, score quality with weighted scorecards, and keep
            a single source of truth for every customer — all in one operations
            hub built for agents and managers.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition" aria-label="Previous">
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-white/40" />
              <span className="size-1.5 rounded-full bg-white" />
              <span className="size-1.5 rounded-full bg-white/40" />
              <span className="size-1.5 rounded-full bg-white/40" />
            </div>
            <button className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition" aria-label="Next">
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Right: auth panel */}
      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Headset className="size-5" />
            </div>
            <span className="font-semibold text-lg">Call Centre</span>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">
              {tab === "signin" ? "Welcome back!" : "Create your account"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {tab === "signin"
                ? "Sign in to log calls and manage contacts."
                : "Start logging calls and tracking quality today."}
            </p>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-6">
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full h-11" disabled={busy}>{busy ? "Signing in…" : "Login"}</Button>
                <p className="text-sm text-muted-foreground text-center">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => setTab("signup")} className="text-primary font-medium hover:underline">
                    Sign Up
                  </button>
                </p>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">Email Address</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full h-11" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
                <p className="text-xs text-muted-foreground text-center">New users start as <strong>agents</strong>. A manager can promote you later.</p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}