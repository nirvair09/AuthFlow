import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
const AuthContext = createContext(null);
export function AuthProvider({ children, authUrl }) {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetchUser = useCallback(async (token) => {
        const res = await axios.get(`${authUrl}/profile`, {
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
        }
        catch {
            setUser(null);
            setAccessToken(null);
        }
    }, [authUrl, fetchUser]);
    useEffect(() => {
        refreshSession().finally(() => setLoading(false));
    }, [refreshSession]);
    async function signIn(email, password) {
        const res = await axios.post(`${authUrl}/v1/auth/sign-in`, { email, password }, { withCredentials: true });
        const token = res.data.access_token;
        setAccessToken(token);
        const info = await fetchUser(token);
        setUser(info);
    }
    async function signUp(email, password, name) {
        await axios.post(`${authUrl}/v1/auth/register`, { email, password, name });
        await signIn(email, password);
    }
    async function signOut() {
        await axios.post(`${authUrl}/v1/auth/sign-out`, {}, { withCredentials: true });
        setUser(null);
        setAccessToken(null);
    }
    return (_jsx(AuthContext.Provider, { value: {
            user,
            loading,
            accessToken,
            signIn,
            signUp,
            signOut,
            refreshSession,
        }, children: children }));
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("useAuth must be inside <AuthProvider />");
    return ctx;
}
