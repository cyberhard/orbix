import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Save } from "lucide-react";

export const ScheduledTasks: React.FC = () => {
  const [crontab, setCrontab] = useState(
    "# Periodic system maintenance and circumvention list sync\n" +
      "0 4 * * * /usr/bin/podkop update >/dev/null 2>&1\n" +
      "30 4 * * 1 /etc/init.d/zapret restart >/dev/null 2>&1\n"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Scheduled Tasks (Crontab)</h2>
          <p className="text-xs text-muted-foreground">Automate background maintenance, list updates, and log rotations</p>
        </div>
        <Button variant="default" size="sm" className="text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-500">
          <Save className="h-3.5 w-3.5" />
          Save Crontab
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Crontab Editor (/etc/crontabs/root)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <textarea
            value={crontab}
            onChange={(e) => setCrontab(e.target.value)}
            className="w-full h-56 p-3 rounded-lg border bg-black/60 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="text-[11px] text-muted-foreground">
            Format: <code className="font-mono text-foreground">minute hour day-of-month month day-of-week command</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
