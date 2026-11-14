import React, { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Router, Lock, User, AlertCircle, ArrowRight, Languages } from "lucide-react";

export const LoginView: React.FC = () => {
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("root");
  const { login, isLoading, error } = useAuthStore();
  const { t, lang, toggleLang } = useI18nStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <div className="absolute top-4 right-4">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLang}
          className="h-8 px-2 text-xs font-mono font-semibold gap-1.5 border-border/80"
        >
          <Languages className="h-3.5 w-3.5 text-primary" />
          <span>{lang.toUpperCase()}</span>
        </Button>
      </div>

      <Card className="w-full max-w-md border-border/80 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center pb-6 border-b border-border/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30 mb-2">
            <Router className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">{t.login.title}</CardTitle>
          <CardDescription className="text-xs">
            {t.login.subtitle}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{t.login.username}</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-9 text-xs font-mono"
                  placeholder="root"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{t.login.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-9 text-xs font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full text-xs h-9 gap-1.5 font-medium shadow-md"
            >
              {isLoading ? t.login.authenticating : t.login.submit}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <div className="text-[11px] text-muted-foreground text-center">
              {t.login.defaultCreds}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
