import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { useUciStore } from "@/store/uci-store";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoginView } from "@/views/auth/LoginView";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { fetchChanges } = useUciStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchChanges();
      const interval = setInterval(fetchChanges, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchChanges]);

  return (
    <QueryClientProvider client={queryClient}>
      {isAuthenticated ? <MainLayout /> : <LoginView />}
    </QueryClientProvider>
  );
};
