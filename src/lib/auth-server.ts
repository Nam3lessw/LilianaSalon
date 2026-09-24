import { NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  admin: boolean;
}

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "liliana-salon";

// Cache Google's public JWKS endpoint for signature verification
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

/**
 * Extracts and cryptographically verifies the Firebase ID Token from the Authorization header
 * directly using Google's public JSON Web Key Sets (JWKS).
 * Works reliably across all Node.js and Vercel Serverless environments without bundling bugs.
 */
export async function verifyAuthToken(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    return {
      uid: (payload.user_id || payload.sub) as string,
      email: payload.email as string | undefined,
      admin: Boolean(payload.admin),
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
