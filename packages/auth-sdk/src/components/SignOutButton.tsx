import { useAuth } from "../AuthContext";

export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => signOut()}
      className="text-red-600 hover:text-red-800"
    >
      Sign Out
    </button>
  );
}
