import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        const username = process.env.ADMIN_USERNAME;
        const password = process.env.ADMIN_PASSWORD;
        if (
          username &&
          password &&
          credentials?.username === username &&
          credentials?.password === password
        ) {
          return { id: "admin", name: "Admin" };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: "/admin/login" },
  secret: process.env.AUTH_SECRET,
});
