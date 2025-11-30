import { createContext, useContext, useEffect, useState } from "react";
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
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
  authUrl
}: {
  children: React.ReactNode;
  authUrl: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh access token on page load
  useEffect(() => {
    axios.post(`${authUrl}/v1/auth/refresh`, {}, { withCredentials: true })
      .then(async (res) => {
        setAccessToken(res.data.access_token);
        const userInfo = await fetchUser(res.data.access_token);
        setUser(userInfo);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function fetchUser(token: string): Promise<User> {
    const base = localStorage.getItem("backend") || "http://localhost:5001";

    const res = await axios.get(`${base}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return res.data;
  }

  async function signIn(email: string, password: string) {
    const res = await axios.post(`${authUrl}/v1/auth/sign-in`,
      { email, password },
      { withCredentials: true }
    );

    setAccessToken(res.data.access_token);
    const userInfo = await fetchUser(res.data.access_token);
    setUser(userInfo);
  }

  async function signUp(email: string, password: string, name: string) {
    await axios.post(`${authUrl}/v1/auth/register`,
      { email, password, name }
    );
    await signIn(email, password);
  }

  async function signOut() {
    await axios.post(`${authUrl}/v1/auth/sign-out`, {}, { withCredentials: true });
    setUser(null);
    setAccessToken(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      accessToken,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider />");
  return ctx;
}
