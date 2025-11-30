import { jsx as _jsx } from "react/jsx-runtime";
import { useAuth } from "../AuthContext";
export function SignOutButton() {
    const { signOut } = useAuth();
    return (_jsx("button", { onClick: () => signOut(), className: "text-red-600 hover:text-red-800", children: "Sign Out" }));
}
