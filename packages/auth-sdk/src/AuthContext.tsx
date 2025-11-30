import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

type User = {
  id: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, authUrl }: { children: React.ReactNode; authUrl: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (token: string) => {
    const res = await axios.get(`${authUrl}/v1/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    });
    return res.data.user;
  }, [authUrl]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await axios.post(`${authUrl}/v1/auth/refresh`, {}, { withCredentials: true });
      const token = res.data.access_token;

      setAccessToken(token);

      const info = await fetchUser(token);
      setUser(info);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, [authUrl, fetchUser]);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  async function signIn(email: string, password: string) {
    const res = await axios.post(
      `${authUrl}/v1/auth/sign-in`,
      { email, password },
      { withCredentials: true }
    );

    const token = res.data.access_token;
    setAccessToken(token);

    const info = await fetchUser(token);
    setUser(info);
  }

  async function signUp(email: string, password: string, name: string) {
    await axios.post(`${authUrl}/v1/auth/register`, { email, password, name });
    await signIn(email, password);
  }

  async function signOut() {
    await axios.post(`${authUrl}/v1/auth/sign-out`, {}, { withCredentials: true });
    setUser(null);
    setAccessToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        signIn,
        signUp,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider />");
  return ctx;
}
