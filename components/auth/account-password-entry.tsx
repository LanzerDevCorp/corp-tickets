import Link from "next/link";
import { getPasswordDecision } from "@/app/actions/client-password";

/**
 * Account-menu entry that lets an authenticated client create or change their
 * password. Reads the decision server-side and links to the set-password screen
 * in manage mode. Flow 3 imports this into the /track account menu.
 */
export async function AccountPasswordEntry({
  className,
}: {
  className?: string;
}) {
  const decision = await getPasswordDecision();
  if (decision.error) {
    return null;
  }

  const label = decision.hasPassword ? "Cambiar contraseña" : "Crear contraseña";

  return (
    <Link href="/auth/set-password?manage=1" className={className}>
      {label}
    </Link>
  );
}
