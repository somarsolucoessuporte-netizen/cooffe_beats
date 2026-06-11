import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.senha) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email },
          include: { empresa: true },
        });

        if (!usuario || !usuario.ativo) return null;

        const senhaCorreta = await bcrypt.compare(credentials.senha, usuario.senha);
        if (!senhaCorreta) return null;

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
          empresaId: usuario.empresaId,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.perfil = (user as { perfil?: string }).perfil;
        token.empresaId = (user as { empresaId?: string }).empresaId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { perfil?: string }).perfil = token.perfil as string;
        (session.user as { empresaId?: string }).empresaId = token.empresaId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
