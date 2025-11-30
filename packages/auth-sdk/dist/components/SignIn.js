import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAuth } from "../AuthContext";
import Modal from "../ui/Modal";
export function SignIn({ open, onClose }) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    async function handleSignIn(e) {
        e.preventDefault();
        await signIn(email, password);
        onClose();
    }
    return (_jsxs(Modal, { open: open, onClose: onClose, children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Sign In" }), _jsxs("form", { className: "flex flex-col gap-3", onSubmit: handleSignIn, children: [_jsx("input", { className: "border p-2 rounded", placeholder: "Email", type: "email", value: email, onChange: (e) => setEmail(e.currentTarget.value), required: true }), _jsx("input", { className: "border p-2 rounded", type: "password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.currentTarget.value), required: true }), _jsx("button", { className: "bg-black text-white rounded py-2 hover:bg-gray-800", type: "submit", children: "Sign In" })] })] }));
}
