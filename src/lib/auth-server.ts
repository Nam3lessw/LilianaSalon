import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  admin: boolean;
}

/**
 * Extracts and verifies the Firebase ID Token from the Authorization header.
 * Derives user identity strictly from the verified cryptographical token.
 */
export async function verifyAuthToken(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) return null;

    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      admin: Boolean(decodedToken.admin),
    };
  } catch (error) {
    console.warn("Failed to verify Firebase ID Token on server:", error);
    return null;
  }
}

/**
 * Verifies that the requester has a valid Firebase ID Token AND the `admin: true` Custom Claim.
 */
export async function verifyAdminAuthToken(req: NextRequest): Promise<AuthenticatedUser | null> {
  const user = await verifyAuthToken(req);
  if (!user || !user.admin) {
    return null;
  }
  return user;
}
