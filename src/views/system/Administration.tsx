import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Key, ShieldCheck, Save, Loader2 } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

export const Administration: React.FC = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  // Dropbear settings
  const [sshPort, setSshPort] = useState("22");
  const [passwordAuth, setPasswordAuth] = useState(true);
  const [rootPasswordAuth, setRootPasswordAuth] = useState(true);
  const [sshLoading, setSshLoading] = useState(false);

  // Authorized keys
  const [authorizedKeys, setAuthorizedKeys] = useState("");
  const [keysLoading, setKeysLoading] = useState(false);

  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const { lang } = useI18nStore();

  useEffect(() => {
    loadDropbearAndKeys();
  }, []);

  const loadDropbearAndKeys = async () => {
    try {
      const [dropbearRes, keysRes] = await Promise.all([
        ubusClient.getUci<Record<string, any>>("dropbear").catch(() => null),
        ubusClient.readFile("/etc/dropbear/authorized_keys").catch(() => ""),
      ]);

      if (dropbearRes?.values) {
        const main = dropbearRes.values.main || Object.values(dropbearRes.values)[0] as any;
        if (main) {
          setSshPort(String(main.Port || "22"));
          setPasswordAuth(main.PasswordAuth === "on" || main.PasswordAuth === "1");
          setRootPasswordAuth(main.RootPasswordAuth === "on" || main.RootPasswordAuth === "1");
        }
      }

      setAuthorizedKeys(keysRes || "");
    } catch (e) {
      console.error("Failed to load admin settings:", e);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword) {
      setFeedback({ text: lang === "ru" ? "Введите новый пароль." : "Please enter a new password.", error: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ text: lang === "ru" ? "Пароли не совпадают!" : "Passwords do not match!", error: true });
      return;
    }

    setPassLoading(true);
    setFeedback(null);
    try {
      await ubusClient.setRootPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({
        text: lang === "ru"
          ? "Пароль root успешно обновлён в системе OpenWrt!"
          : "Root password successfully updated on OpenWrt!",
      });
    } catch (err: any) {
      setFeedback({ text: `Failed to change root password: ${err.message}`, error: true });
    } finally {
      setPassLoading(false);
    }
  };

  const handleSaveDropbear = async () => {
    setSshLoading(true);
    setFeedback(null);
    try {
      await ubusClient.setUci("dropbear", "main", {
        Port: sshPort,
        PasswordAuth: passwordAuth ? "on" : "off",
        RootPasswordAuth: rootPasswordAuth ? "on" : "off",
      });
      await ubusClient.commitUci("dropbear");
      try {
        await ubusClient.initService("dropbear", "restart");
      } catch {}

      setFeedback({
        text: lang === "ru"
          ? "Настройки Dropbear SSH сохранены и служба перезапущена!"
          : "Dropbear SSH settings saved and service restarted!",
      });
    } catch (err: any) {
      setFeedback({ text: `Failed to save Dropbear config: ${err.message}`, error: true });
    } finally {
      setSshLoading(false);
    }
  };

  const handleSaveKeys = async () => {
    setKeysLoading(true);
    setFeedback(null);
    try {
      await ubusClient.writeFile("/etc/dropbear/authorized_keys", authorizedKeys);
      setFeedback({
        text: lang === "ru"
          ? "Ключи SSH (/etc/dropbear/authorized_keys) успешно сохранены!"
          : "Authorized SSH keys saved successfully!",
      });
    } catch (err: any) {
      setFeedback({ text: `Failed to save authorized keys: ${err.message}`, error: true });
    } finally {
      setKeysLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">
          {lang === "ru" ? "Администрирование и SSH доступ" : "Administration & SSH Access"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {lang === "ru"
            ? "Управление системным паролем root, службой Dropbear SSH и авторизованными публичными ключами"
            : "Manage system root password, Dropbear SSH daemon, and authorized SSH public keys"}
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedback.error
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Router Root Password */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <span>{lang === "ru" ? "Пароль администратора (root)" : "Router Root Password"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">
                {lang === "ru" ? "Новый пароль root" : "New Password"}
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">
                {lang === "ru" ? "Подтверждение пароля" : "Confirm Password"}
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="font-mono text-xs"
              />
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={handlePasswordChange}
              disabled={passLoading || !newPassword}
              className="w-full text-xs gap-1.5"
            >
              {passLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{lang === "ru" ? "Сменить пароль root" : "Change Root Password"}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Dropbear SSH */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{lang === "ru" ? "Служба Dropbear SSH" : "Dropbear SSH Access"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1">
              <label className="text-muted-foreground">{lang === "ru" ? "Порт SSH" : "SSH Port"}</label>
              <Input
                value={sshPort}
                onChange={(e) => setSshPort(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">
                  {lang === "ru" ? "Вход по паролю" : "Password Authentication"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lang === "ru" ? "Разрешить аутентификацию по паролю через SSH" : "Allow SSH password login"}
                </div>
              </div>
              <Switch checked={passwordAuth} onCheckedChange={setPasswordAuth} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">
                  {lang === "ru" ? "Вход для root по паролю" : "Root Password Login"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lang === "ru" ? "Разрешить прямому root вход по паролю" : "Allow direct root password login"}
                </div>
              </div>
              <Switch checked={rootPasswordAuth} onCheckedChange={setRootPasswordAuth} />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDropbear}
              disabled={sshLoading}
              className="w-full text-xs gap-1.5 border-zinc-800"
            >
              {sshLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{lang === "ru" ? "Сохранить параметры SSH" : "Save SSH Settings"}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Authorized SSH Keys */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              <span>{lang === "ru" ? "Авторизованные SSH ключи (/etc/dropbear/authorized_keys)" : "Authorized SSH Public Keys"}</span>
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
              ed25519 / rsa
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            <textarea
              value={authorizedKeys}
              onChange={(e) => setAuthorizedKeys(e.target.value)}
              placeholder="ssh-ed25519 AAAAC3... user@host"
              className="w-full h-32 p-3 rounded-lg border border-zinc-800 bg-black/80 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveKeys}
                disabled={keysLoading}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 gap-1.5"
              >
                {keysLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{lang === "ru" ? "Сохранить SSH ключи" : "Save Authorized Keys"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
