import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Headset, Phone, ClipboardCheck, Users } from "lucide-react";
import authHero from "@/assets/auth-hero.jpg";

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-muted/30">
      {/* Left: brand / product panel */}
      <aside className="relative hidden lg:flex flex-col justify-between p-10 bg-primary text-primary-foreground overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-primary-foreground/10 flex items-center justify-center">
            <Headset className="size-5" />
          </div>
          <span className="font-semibold text-lg">Call Centre</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Run a sharper call centre, one conversation at a time.
          </h1>
          <p className="text-primary-foreground/80">
            Log every call, score quality against your own scorecard, and keep
            a single source of truth for every customer in your CRM.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Phone className="size-4 mt-0.5 shrink-0" />
              <span>Track inbound & outbound calls with audio recordings.</span>
            </li>
            <li className="flex items-start gap-3">
              <ClipboardCheck className="size-4 mt-0.5 shrink-0" />
              <span>Quality-assure agents with weighted scorecards.</span>
            </li>
            <li className="flex items-start gap-3">
              <Users className="size-4 mt-0.5 shrink-0" />
              <span>A built-in CRM with full interaction history.</span>
            </li>
          </ul>
        </div>

        <img
          src={authHero}
          alt="Call centre agents working at their desks"
          className="absolute inset-x-0 bottom-0 w-full opacity-25 object-cover pointer-events-none select-none"
          style={{ maskImage: "linear-gradient(to top, black 30%, transparent 90%)" }}
        />

        <p className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Call Centre — Operations & QA
        </p>
      </aside>

      {/* Right: auth card */}
      <main className="flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2 lg:hidden">
              <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Headset className="size-5" />
              </div>
              <CardTitle>Call Centre</CardTitle>
            </div>
            <CardTitle className="hidden lg:block">Welcome back</CardTitle>
            <CardDescription>Sign in to log calls and manage contacts.</CardDescription>
          </CardHeader>
          <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <form onSubmit={signIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <form onSubmit={signUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
                <p className="text-xs text-muted-foreground text-center">New users start as <strong>agents</strong>. A manager can promote you later.</p>
              </form>
            </TabsContent>
          </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}