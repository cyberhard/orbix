import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackRoute?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ORBIX] Unhandled view render error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== "undefined") {
      window.location.hash = "#/overview";
      window.location.reload();
    }
  };

  private handleCopyDetails = () => {
    const text = `ORBIX Error: ${this.state.error?.message || "Unknown"}\n\nStack:\n${this.state.error?.stack || ""}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ""}`;
    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-2xl mx-auto my-8 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-rose-400 shrink-0 mt-0.5">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-100">
                Ошибка отображения страницы
              </h3>
              <p className="text-xs text-zinc-400">
                Во время отрисовки компонента произошла непредвиденная ошибка. Роутер продолжает работать в штатном режиме.
              </p>
            </div>
          </div>

          {this.state.error && (
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-2">
              <div className="text-xs font-mono text-rose-300 font-semibold break-all">
                {this.state.error.message || String(this.state.error)}
              </div>
              {this.state.error.stack && (
                <div className="max-h-32 overflow-y-auto text-[10px] font-mono text-zinc-500 whitespace-pre-wrap leading-relaxed select-all">
                  {this.state.error.stack}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60">
            <Button
              size="sm"
              onClick={this.handleReset}
              className="text-xs h-8 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Попробовать снова
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={this.handleGoHome}
              className="text-xs h-8 border-zinc-800 text-zinc-300 hover:bg-zinc-900 gap-1.5"
            >
              <Home className="h-3.5 w-3.5" />
              На главную (Обзор)
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleCopyDetails}
              className="text-xs h-8 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 gap-1.5 ml-auto"
            >
              {this.state.copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Копировать отчет</span>
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
