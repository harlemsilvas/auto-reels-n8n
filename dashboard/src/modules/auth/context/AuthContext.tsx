import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  authService,
  type AuthUser,
} from "../services/auth.service";

type LoginInput = {
  username: string;
  password: string;
};

type AuthContextValue = {
  authEnabled: boolean | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
};

const LEGACY_AUTH_STORAGE_KEY = "socialbot.admin.auth";
const CSRF_STORAGE_KEY = "socialbot.admin.csrf";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [legacyAuthenticated, setLegacyAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const status = await authService.getStatus();

        if (!active) return;
        setAuthEnabled(status.enabled);

        if (!status.enabled) {
          setLegacyAuthenticated(
            localStorage.getItem(LEGACY_AUTH_STORAGE_KEY) === "1",
          );
          return;
        }

        localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
        const [me, csrf] = await Promise.all([
          authService.getMe(),
          authService.getCsrf(),
        ]);

        if (!active) return;
        sessionStorage.setItem(CSRF_STORAGE_KEY, csrf.csrfToken);
        setUser(me.user);
      } catch {
        if (active) {
          sessionStorage.removeItem(CSRF_STORAGE_KEY);
          setUser(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function login(input: LoginInput): Promise<boolean> {
    if (authEnabled === false) {
      const valid = input.username === "admin" && input.password === "123456";
      if (valid) {
        localStorage.setItem(LEGACY_AUTH_STORAGE_KEY, "1");
        setLegacyAuthenticated(true);
      }
      return valid;
    }

    if (authEnabled === null) {
      return false;
    }

    try {
      const result = await authService.login(input);
      sessionStorage.setItem(CSRF_STORAGE_KEY, result.csrfToken);
      setUser(result.user);
      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    if (authEnabled) {
      await authService
        .logout(sessionStorage.getItem(CSRF_STORAGE_KEY))
        .catch(() => null);
    }

    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
    setLegacyAuthenticated(false);
    setUser(null);
  }

  const isAuthenticated =
    authEnabled === false ? legacyAuthenticated : !!user;
  const value = {
    authEnabled,
    isLoading,
    isAuthenticated,
    user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
