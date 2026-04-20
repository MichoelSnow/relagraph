import { eq } from "drizzle-orm"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

import { getDb } from "@/db/client"
import { appUser } from "@/db/schema"
import { verifyPassword } from "@/lib/auth/password"
import { enforceRateLimit, extractIpFromHeaders } from "@/server/api/rate_limit"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id
      }
      if (user?.email) {
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (!session.user) {
        session.user = {}
      }

      if (token.sub) {
        ;(session.user as { id?: string }).id = token.sub
      }
      if (typeof token.email === "string") {
        session.user.email = token.email
      }

      return session
    }
  },
  pages: {
    signIn: "/login"
  },
  logger: {
    error(code) {
      if (code === "JWT_SESSION_ERROR") {
        return
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        const ipAddress = extractIpFromHeaders(req.headers ?? {})
        const rateLimitError = enforceRateLimit({
          scope: "auth:login",
          subject: ipAddress,
          limit: 10,
          windowMs: 60_000
        })
        if (rateLimitError) {
          return null
        }

        const username = credentials?.username?.trim().toLowerCase() ?? ""
        const password = credentials?.password ?? ""
        if (!username || !password) {
          return null
        }

        const db = getDb()
        const users = await db
          .select({ id: appUser.id, email: appUser.email, passwordHash: appUser.passwordHash })
          .from(appUser)
          .where(eq(appUser.email, username))
          .limit(1)

        const user = users[0]
        if (!user || !verifyPassword(password, user.passwordHash)) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.email
        }
      }
    })
  ]
}
