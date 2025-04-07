// auth.config.js

// Use import instead of require
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import { compare, hash } from "bcryptjs"; // Use import

// This is a simple in-memory database for demo purposes
// In a real app, you would use a real database
const users = [
  {
    id: "1",
    name: "Admin",
    email: "admin@example.com",
    password: "$2b$10$zQSMW7UiBn8t3EBSuP6w3e5iUH0ZldqUXYXG6J.5W8dVOq1SkTKHe", // Example hashed password
  },
];

// Use export const instead of putting it in module.exports
export const authOptions = {
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = users.find((user) => user.email === credentials.email);
        if (!user) {
          return null;
        }
        // compare function imported via ES Module import
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // Add id to session user object (adjust type if using JSDoc/TS checks)
         session.user.id = token.id;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Helper function to register a new user
// Use export async function instead of putting it in module.exports
export async function registerUser(name, email, password) {
  const existingUser = users.find((user) => user.email === email);
  if (existingUser) {
    throw new Error("User already exists");
  }
  // hash function imported via ES Module import
  const hashedPassword = await hash(password, 10);
  const newUser = {
    id: (users.length + 1).toString(),
    name,
    email,
    password: hashedPassword,
  };
  users.push(newUser);
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
  };
}

// Remove the old module.exports line completely
// module.exports = { authOptions, registerUser }; // DELETE THIS LINE