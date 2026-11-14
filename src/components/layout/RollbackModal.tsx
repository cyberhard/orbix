import React from "react";
import { useRollbackStore } from "@/store/rollback-store";
import { useI18nStore } from "@/store/i18n-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";

export const RollbackModal: React.FC = () => {
  const {
    isModalOpen,
    secondsRemaining,
    timeout,
    confirm,
    rollbackNow,
    isApplying,
    error,
  } = useRollbackStore();
  const { language } = useI18nStore();
  const isRu = language === "ru";

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / (timeout || 75)) * 100));

  return (
    <Dialog open={isModalOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl p-6 sm:rounded-xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400">
              <ShieldAlert className="h-5 w-5 animate-pulse text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight text-zinc-100">
                {isRu ? "Сторожевой таймер отката активен" : "Safety Rollback Watchdog Active"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {isRu
                  ? "Автоматическая защита от потери доступа к роутеру"
                  : "Automatic fail-safe against network lockout"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4 space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-3xl font-mono font-bold tracking-tight tabular-nums text-zinc-100">
              {secondsRemaining}s
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              {isRu
                ? `Осталось времени до автоматического отката`
                : `Time remaining before automatic restoration`}
            </p>
            <div className="mt-3">
              <Progress value={progressPercent} className="h-1.5 bg-zinc-800" />
            </div>
          </div>

          <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
            <p>
              {isRu
                ? "Конфигурация сети, PBR и туннелей применена. Если ваше интернет-соединение или Wi-Fi работают стабильно, подтвердите сохранение параметров."
                : "Network, PBR, and VPN configurations have been reloaded. If your connection and Wi-Fi are stable, confirm the new settings."}
            </p>
            <p className="text-[11px] text-zinc-500">
              {isRu
                ? "Если вы потеряете связь с роутером или таймер истечёт, демон OpenWrt восстановит резервную копию /etc/config и вернёт доступ."
                : "If you lose connectivity or the timer runs out, the OpenWrt daemon will automatically restore the /etc/config backup."}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-950/40 border border-red-900/50 p-2.5 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-900">
          <Button
            variant="outline"
            size="sm"
            onClick={() => rollbackNow()}
            disabled={isApplying}
            className="w-full sm:w-auto text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-red-400 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isRu ? "Откатить сейчас" : "Rollback Now"}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => confirm()}
            disabled={isApplying || secondsRemaining <= 0}
            className="w-full sm:w-auto text-xs bg-zinc-100 text-zinc-950 hover:bg-white font-medium gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {isRu ? "Подтвердить подключение" : "Confirm Working Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};