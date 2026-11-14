import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUciStore } from "@/store/uci-store";
import { useI18nStore } from "@/store/i18n-store";
import { Badge } from "@/components/ui/badge";
import { Check, RotateCcw, AlertTriangle } from "lucide-react";

export const DiffModal: React.FC = () => {
  const { isDiffOpen, setDiffOpen, changes, commitAndApply, revertAll, isApplying, applyProgress } =
    useUciStore();
  const { t } = useI18nStore();

  const configs = Object.keys(changes);

  return (
    <Dialog open={isDiffOpen} onOpenChange={setDiffOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <span>{t.staging.diffTitle}</span>
              <Badge variant="warning">{configs.length} {t.staging.configsModified}</Badge>
            </DialogTitle>
          </div>
          <DialogDescription>
            {t.staging.diffDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {configs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t.staging.noPending}
            </div>
          ) : (
            configs.map((cfg) => {
              const diffs = changes[cfg];
              return (
                <div key={cfg} className="border rounded-lg bg-card/60 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-mono text-xs font-semibold text-primary">/etc/config/{cfg}</span>
                    <Badge variant="outline" className="text-[10px]">Staged</Badge>
                  </div>
                  <pre className="text-xs font-mono bg-background/80 p-3 rounded overflow-x-auto text-emerald-400">
                    {JSON.stringify(diffs, null, 2)}
                  </pre>
                </div>
              );
            })
          )}

          {applyProgress && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary animate-pulse">
              <AlertTriangle className="h-4 w-4" />
              <span>{applyProgress}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => revertAll()}
            disabled={isApplying || configs.length === 0}
            className="text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            {t.staging.revertAll}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDiffOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => commitAndApply()}
              disabled={isApplying || configs.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {isApplying ? t.staging.applying : t.staging.saveApply}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
