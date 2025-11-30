import { useState } from "react";
import { useAuth } from "../AuthContext";
import Modal from "../ui/Modal";

export function SignUp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    await signUp(email, password, name);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-xl font-semibold mb-4">Create Account</h2>

      <form className="flex flex-col gap-3" onSubmit={handleSignUp}>
        <input
          className="border p-2 rounded"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border p-2 rounded"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border p-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          className="bg-blue-600 text-white rounded py-2 hover:bg-blue-700"
          type="submit"
        >
          Sign Up
        </button>
      </form>
    </Modal>
  );
}
