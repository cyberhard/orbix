import React from "react";
import { useUciStore } from "@/store/uci-store";
import { useI18nStore } from "@/store/i18n-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Eye, RotateCcw } from "lucide-react";

export const UciStagingBar: React.FC = () => {
  const { pendingCount, setDiffOpen, commitAndApply, revertAll, isApplying } = useUciStore();
  const { t } = useI18nStore();

  if (pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl bg-card/95 border border-amber-500/30 backdrop-blur-md rounded-xl p-3 shadow-2xl shadow-black/40 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{t.staging.uncommittedTitle}</span>
            <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">
              {pendingCount}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">{t.staging.uncommittedDesc}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDiffOpen(true)}
          className="h-8 text-xs gap-1 border-border/80 hover:bg-accent"
        >
          <Eye className="h-3.5 w-3.5" />
          {t.common.reviewDiff}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => revertAll()}
          disabled={isApplying}
          className="h-8 text-xs text-muted-foreground hover:text-destructive"
          title={t.staging.revertAll}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => commitAndApply()}
          disabled={isApplying}
          className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
        >
          <Check className="h-3.5 w-3.5" />
          {isApplying ? t.staging.applying : t.common.apply}
        </Button>
      </div>
    </div>
  );
};
