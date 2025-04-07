// auth.config.ts
import type { User, Session } from "next-auth"; // Import necessary types
import type { JWT } from "next-auth/jwt";
import type { AuthOptions } from "@auth/core";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import { compare, hash } from "bcryptjs"; // Use import for bcryptjs

// Define a simple user type for your in-memory store if needed
interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // Only for internal storage, never send to client
}

// This is a simple in-memory database for demo purposes
const users: AppUser[] = [
  {
    id: "1",
    name: "Admin",
    email: "admin@example.com",
    password: "$2b$10$zQSMW7UiBn8t3EBSuP6w3e5iUH0ZldqUXYXG6J.5W8dVOq1SkTKHe", // Example hashed password
  },
];

interface Credentials {
  email: string;
  password: string;
}

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: Credentials | undefined): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = users.find((u) => u.email === credentials.email);
        if (!user || !user.password) {
          return null;
        }
        const isPasswordValid = await compare(credentials.password, user.password);
        if (!isPasswordValid) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User | null }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Export the registerUser function
export async function registerUser(name: string, email: string, password: string): Promise<Omit<AppUser, 'password'>> {
  const existingUser = users.find((u) => u.email === email);
  if (existingUser) {
    throw new Error("User already exists");
  }
  const hashedPassword = await hash(password, 10);
  const newUser: AppUser = {
    id: (users.length + 1).toString(),
    name,
    email,
    password: hashedPassword,
  };
  users.push(newUser);
  const { password: _, ...userToReturn } = newUser;
  return userToReturn;
}