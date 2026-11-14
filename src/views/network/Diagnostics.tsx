import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, Play } from "lucide-react";

export const Diagnostics: React.FC = () => {
  const [target, setTarget] = useState("1.1.1.1");
  const [tool, setTool] = useState<"ping" | "traceroute" | "nslookup">("ping");
  const [output, setOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    setOutput(null);
    await new Promise((r) => setTimeout(r, 700));

    if (tool === "ping") {
      setOutput(
        `PING ${target} (${target}): 56 data bytes\n` +
          `64 bytes from ${target}: seq=0 ttl=55 time=32.9 ms\n` +
          `64 bytes from ${target}: seq=1 ttl=55 time=33.1 ms\n` +
          `64 bytes from ${target}: seq=2 ttl=55 time=32.8 ms\n\n` +
          `--- ${target} ping statistics ---\n` +
          `3 packets transmitted, 3 packets received, 0% packet loss\n` +
          `round-trip min/avg/max = 32.8/32.9/33.1 ms`
      );
    } else if (tool === "traceroute") {
      setOutput(
        `traceroute to ${target} (1.1.1.1), 30 hops max, 38 byte packets\n` +
          ` 1  10.193.76.1 (10.193.76.1)  1.214 ms  0.982 ms  0.871 ms\n` +
          ` 2  195.175.12.1 (195.175.12.1)  4.321 ms  3.982 ms  4.112 ms\n` +
          ` 3  one.one.one.one (1.1.1.1)  32.894 ms  32.912 ms  32.784 ms`
      );
    } else {
      setOutput(
        `Server:    127.0.0.1\nAddress:   127.0.0.1#53\n\n` +
          `Name:      ${target}\nAddress 1: 104.16.132.229\nAddress 2: 104.16.133.229`
      );
    }
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">Network Diagnostics</h2>
        <p className="text-xs text-muted-foreground">ICMP Ping, UDP/ICMP Traceroute, and DNS resolution directly from router</p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={tool === "ping" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("ping")}
                className="text-xs h-8"
              >
                Ping
              </Button>
              <Button
                variant={tool === "traceroute" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("traceroute")}
                className="text-xs h-8"
              >
                Traceroute
              </Button>
              <Button
                variant={tool === "nslookup" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("nslookup")}
                className="text-xs h-8"
              >
                Nslookup
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target Host / IP..."
                className="h-8 text-xs font-mono w-48 sm:w-64"
                onKeyDown={(e) => e.key === "Enter" && handleRun()}
              />
              <Button
                variant="default"
                size="sm"
                onClick={handleRun}
                disabled={isRunning}
                className="h-8 text-xs gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                {isRunning ? "Running..." : "Run"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-72 w-full overflow-y-auto bg-black/60 font-mono text-xs p-4 text-emerald-400 whitespace-pre-wrap">
            {output || (
              <span className="text-muted-foreground">
                Enter an IP address or hostname and press Run to execute {tool}.
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
