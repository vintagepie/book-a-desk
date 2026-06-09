import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, setAuthTokenGetter } from "@workspace/api-client-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("bas_token"));
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("bas_token"));
  }, []);

  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const login = (newToken: string) => {
    localStorage.setItem("bas_token", newToken);
    setToken(newToken);
    setAuthTokenGetter(() => newToken);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const logout = () => {
    localStorage.removeItem("bas_token");
    setToken(null);
    setAuthTokenGetter(() => null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.clear();
  };

  const isLoading = token ? isUserLoading : false;

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        token,
        login,
        logout,
        isLoading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
