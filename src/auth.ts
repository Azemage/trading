import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/credentials";
import { verifyTwoFactorCode } from "@/lib/two-factor";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        code: {},
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const code = String(credentials?.code ?? "").trim();

        const user = await verifyPassword(email, password);
        if (!user) return null;

        if (user.twoFactorEnabled) {
          if (!user.twoFactorSecret || !code || !(await verifyTwoFactorCode(user.twoFactorSecret, code))) {
            return null;
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "CLIENT" | "MANAGER";
      }
      return session;
    },
  },
});
