import { users } from "@shared/schema";
import { db } from "../../db";
import { eq, or } from "drizzle-orm";
import type { UpsertUser, User } from "@shared/models/auth";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    // Try to find by googleId first, then by id
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.name,
      lastName: users.name,
      profileImageUrl: users.profileImageUrl,
    }).from(users).where(or(eq(users.googleId, id), eq(users.id, id)));
    
    if (user) {
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName?.split(' ')[0] || null,
        lastName: user.firstName?.split(' ').slice(1).join(' ') || null,
        profileImageUrl: user.profileImageUrl,
      };
    }
    return undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user exists by email (to link Google account to existing user)
    if (userData.email) {
      const [existingUser] = await db.select().from(users).where(eq(users.email, userData.email));
      
      if (existingUser) {
        // Link Google account to existing user
        const [updated] = await db
          .update(users)
          .set({
            googleId: userData.id,
            profileImageUrl: userData.profileImageUrl || existingUser.profileImageUrl,
          })
          .where(eq(users.id, existingUser.id))
          .returning();
        
        return {
          id: updated.id,
          email: updated.email,
          firstName: updated.name?.split(' ')[0] || null,
          lastName: updated.name?.split(' ').slice(1).join(' ') || null,
          profileImageUrl: updated.profileImageUrl,
        };
      }
    }
    
    // Check if user exists by googleId
    const [existingByGoogle] = await db.select().from(users).where(eq(users.googleId, userData.id));
    
    if (existingByGoogle) {
      // Update existing Google-linked user
      const [updated] = await db
        .update(users)
        .set({
          email: userData.email || existingByGoogle.email,
          profileImageUrl: userData.profileImageUrl || existingByGoogle.profileImageUrl,
        })
        .where(eq(users.id, existingByGoogle.id))
        .returning();
      
      return {
        id: updated.id,
        email: updated.email,
        firstName: updated.name?.split(' ')[0] || null,
        lastName: updated.name?.split(' ').slice(1).join(' ') || null,
        profileImageUrl: updated.profileImageUrl,
      };
    }
    
    // Create new user from Google OAuth
    const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'Google User';
    const username = (userData.email?.split('@')[0] || `google_${Date.now()}`).toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const [newUser] = await db
      .insert(users)
      .values({
        username: username,
        password: '', // No password for OAuth users
        name: fullName,
        email: userData.email,
        googleId: userData.id,
        profileImageUrl: userData.profileImageUrl,
        role: 'engineer',
        roles: ['engineer'],
        status: 'active',
      })
      .returning();
    
    return {
      id: newUser.id,
      email: newUser.email,
      firstName: fullName.split(' ')[0] || null,
      lastName: fullName.split(' ').slice(1).join(' ') || null,
      profileImageUrl: newUser.profileImageUrl,
    };
  }
}

export const authStorage = new AuthStorage();
