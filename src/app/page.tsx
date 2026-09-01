import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/lib/auth/navigation";

export default function Home() {
	redirect(AUTH_ROUTES.login);
}
