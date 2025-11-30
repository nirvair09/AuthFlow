import { useState } from "react";
import { useAuth } from "../AuthContext";
import Modal from "../ui/Modal";

export function SignIn({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    await signIn(email, password);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-xl font-semibold mb-4">Sign In</h2>

      <form className="flex flex-col gap-3" onSubmit={handleSignIn}>
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
          className="bg-black text-white rounded py-2 hover:bg-gray-800"
          type="submit"
        >
          Sign In
        </button>
      </form>
    </Modal>
  );
}
