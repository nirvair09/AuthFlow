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
export declare function AuthProvider({ children, authUrl }: {
    children: React.ReactNode;
    authUrl: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function useAuth(): AuthContextType;
export {};
//# sourceMappingURL=AuthContext.d.ts.map