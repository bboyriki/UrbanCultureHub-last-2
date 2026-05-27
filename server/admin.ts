import { storage } from "./storage";
import { log } from "./logger";
import { UserRole } from "../shared/schema";

const ADMIN_ROLES: string[] = [UserRole.ADMIN, 'super_admin'];

async function ensureAdminUser(email: string, displayName: string, firebaseUid?: string, role: string = UserRole.ADMIN) {
  try {
    let existingUser = null;
    
    if (firebaseUid) {
      existingUser = await storage.getUserByFirebaseUid(firebaseUid);
    }
    
    if (!existingUser) {
      existingUser = await storage.getUserByEmail(email);
    }
    
    if (!existingUser) {
      log(`Creating admin user: ${email}`);
      const admin = await storage.createUser({
        email,
        displayName,
        role: role as any,
        firebaseUid: firebaseUid || null,
        password: null,
        profilePicture: null,
        bio: null,
        artType: null,
        organizationName: null,
        kvkNumber: null,
        btwNumber: null,
        location: null,
        stripeCustomerId: null,
      });
      
      if (admin) {
        await storage.updateUser(admin.id, {
          isVerified: true,
          isApproved: true
        });
        log(`Admin user created: ${email} (ID: ${admin.id})`);
      }
      
      return admin;
    } else {
      const needsUpdate = !ADMIN_ROLES.includes(existingUser.role) || !existingUser.isVerified || !existingUser.isApproved;
      if (needsUpdate) {
        log(`Updating user ${email} to ${role} with correct permissions`);
        const updatedAdmin = await storage.updateUser(existingUser.id, {
          role: role as any,
          isVerified: true,
          isApproved: true,
          displayName
        });
        
        return updatedAdmin;
      }
      
      log(`Admin user already exists: ${email}`);
      return existingUser;
    }
  } catch (error) {
    log(`Error ensuring admin user ${email}: ${error}`);
    return null;
  }
}

export async function createDefaultAdmin() {
  try {
    // Admin credentials come from environment variables — never hardcoded in source
    const admin1Email = process.env.ADMIN1_EMAIL || "oudaialmouti@gmail.com";
    const admin1Uid   = process.env.ADMIN1_FIREBASE_UID;
    const admin2Email = process.env.ADMIN2_EMAIL || "rmaru2889@gmail.com";
    await ensureAdminUser(admin1Email, "Admin", admin1Uid, UserRole.ADMIN);
    await ensureAdminUser(admin2Email, "Super Admin", undefined, 'super_admin');
    
    log("All default admin users processed");
  } catch (error) {
    log(`Error creating default admins: ${error}`);
    return null;
  }
}
