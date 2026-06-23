import { redirect } from "next/navigation";

// Atalho para o login do painel operacional.
// app/(painel)/login/page.tsx resolve para /login (route group não adiciona segmento de URL).
export default function AdminRedirect() {
  redirect("/login");
}
