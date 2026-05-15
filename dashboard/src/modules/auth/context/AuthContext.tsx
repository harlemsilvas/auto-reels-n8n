import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LoginInput = {
  username: string;
  password: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<boolean>;
  logout: () => void;
};

const AUTH_STORAGE_KEY = "socialbot.admin.auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_STORAGE_KEY) === "1";
  });

  async function login(input: LoginInput): Promise<boolean> {
    const isValid = input.username === "admin" && input.password === "123456";

    if (isValid) {
      localStorage.setItem(AUTH_STORAGE_KEY, "1");
      setIsAuthenticated(true);
      return true;
    }

    return false;
  }

  function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      login,
      logout,
    }),
    [isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
