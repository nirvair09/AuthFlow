import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Modal({ open, onClose, children }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 flex items-center justify-center bg-black/50 z-[1000]", children: _jsxs("div", { className: "bg-white rounded-lg p-6 shadow-xl w-[350px] relative animate-fade-in", children: [_jsx("button", { onClick: onClose, className: "absolute top-2 right-2 text-gray-700 hover:text-black", children: "\u2715" }), children] }) }));
}
