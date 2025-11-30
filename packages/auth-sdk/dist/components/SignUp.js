import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAuth } from "../AuthContext";
import Modal from "../ui/Modal";
export function SignUp({ open, onClose }) {
    const { signUp } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    async function handleSignUp(e) {
        e.preventDefault();
        await signUp(email, password, name);
        onClose();
    }
    return (_jsxs(Modal, { open: open, onClose: onClose, children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Create Account" }), _jsxs("form", { className: "flex flex-col gap-3", onSubmit: handleSignUp, children: [_jsx("input", { className: "border p-2 rounded", placeholder: "Name", value: name, onChange: (e) => setName(e.target.value), required: true }), _jsx("input", { className: "border p-2 rounded", placeholder: "Email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true }), _jsx("input", { className: "border p-2 rounded", type: "password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), required: true }), _jsx("button", { className: "bg-blue-600 text-white rounded py-2 hover:bg-blue-700", type: "submit", children: "Sign Up" })] })] }));
}
