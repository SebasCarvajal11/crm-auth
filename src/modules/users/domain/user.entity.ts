import { v7 as uuidv7 } from "uuid";
import type { User, NewUser, UserPatch } from "../users.types";

export class UserEntity {
  private constructor(
    public readonly id: string,
    public readonly subject: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly role: "admin" | "worker" | "client",
    public readonly firstName: string | null,
    public readonly lastName: string | null,
    public readonly clientKind: "natural" | "juridical" | null,
    public readonly companyName: string | null,
    public readonly profession: string | null,
    public readonly isActive: boolean,
    public readonly emailVerifiedAt: Date | null,
    public readonly lastLoginAt: Date | null,
    public readonly failedLoginAttempts: number,
    public readonly lockedUntil: Date | null,
    public readonly forcePasswordChange: boolean,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    this.validateInvariants();
  }

  private validateInvariants() {
    // 1. Validar Email
    if (!this.email || !this.email.includes("@")) {
      throw new Error("Invalid user email format");
    }
    // 2. Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.id)) {
      throw new Error(`Invalid user ID UUID format: ${this.id}`);
    }
    if (!uuidRegex.test(this.subject)) {
      throw new Error(`Invalid user subject UUID format: ${this.subject}`);
    }
    // 3. Consistencia: Si está eliminado, no puede estar activo
    if (this.deletedAt !== null && this.isActive) {
      throw new Error("A soft-deleted user cannot be active");
    }
    // 4. Failed login attempts
    if (this.failedLoginAttempts < 0) {
      throw new Error("Failed login attempts cannot be negative");
    }
    // 5. Consistencia de Roles
    if (this.role !== "client") {
      if (this.clientKind !== null) {
        throw new Error("Only client users can have a clientKind");
      }
    } else {
      if (this.clientKind && this.clientKind !== "natural" && this.clientKind !== "juridical") {
        throw new Error("Invalid clientKind");
      }
    }
  }

  public static create(data: NewUser): UserEntity {
    const now = new Date();
    return new UserEntity(
      data.id ?? uuidv7(),
      data.subject ?? uuidv7(),
      data.email.toLowerCase().trim(),
      data.passwordHash,
      data.role,
      data.firstName ?? null,
      data.lastName ?? null,
      data.clientKind ?? null,
      data.companyName ?? null,
      data.profession ?? null,
      data.isActive ?? true,
      data.emailVerifiedAt ?? null,
      data.lastLoginAt ?? null,
      data.failedLoginAttempts ?? 0,
      data.lockedUntil ?? null,
      data.forcePasswordChange ?? false,
      data.deletedAt ?? null,
      data.createdAt ?? now,
      data.updatedAt ?? now
    );
  }

  public static fromPersistence(user: User): UserEntity {
    return new UserEntity(
      user.id,
      user.subject,
      user.email,
      user.passwordHash,
      user.role,
      user.firstName,
      user.lastName,
      user.clientKind,
      user.companyName,
      user.profession,
      user.isActive,
      user.emailVerifiedAt,
      user.lastLoginAt,
      user.failedLoginAttempts,
      user.lockedUntil,
      user.forcePasswordChange,
      user.deletedAt,
      user.createdAt,
      user.updatedAt
    );
  }

  public update(patch: UserPatch): UserEntity {
    let newIsActive = patch.isActive !== undefined ? patch.isActive : this.isActive;
    const newDeletedAt = patch.deletedAt !== undefined ? patch.deletedAt : this.deletedAt;
    
    // Si se marca como eliminado y no se especificaisActive, forzamos isActive a false
    if (newDeletedAt !== null && patch.isActive === undefined) {
      newIsActive = false;
    }

    return new UserEntity(
      this.id,
      this.subject,
      this.email,
      patch.passwordHash !== undefined ? patch.passwordHash : this.passwordHash,
      this.role,
      patch.firstName !== undefined ? patch.firstName : this.firstName,
      patch.lastName !== undefined ? patch.lastName : this.lastName,
      patch.clientKind !== undefined ? patch.clientKind : this.clientKind,
      patch.companyName !== undefined ? patch.companyName : this.companyName,
      patch.profession !== undefined ? patch.profession : this.profession,
      newIsActive,
      patch.emailVerifiedAt !== undefined ? patch.emailVerifiedAt : this.emailVerifiedAt,
      patch.lastLoginAt !== undefined ? patch.lastLoginAt : this.lastLoginAt,
      patch.failedLoginAttempts !== undefined ? patch.failedLoginAttempts : this.failedLoginAttempts,
      patch.lockedUntil !== undefined ? patch.lockedUntil : this.lockedUntil,
      patch.forcePasswordChange !== undefined ? patch.forcePasswordChange : this.forcePasswordChange,
      newDeletedAt,
      this.createdAt,
      new Date()
    );
  }

  public toPersistence(): User {
    return {
      id: this.id,
      subject: this.subject,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      firstName: this.firstName,
      lastName: this.lastName,
      clientKind: this.clientKind,
      companyName: this.companyName,
      profession: this.profession,
      isActive: this.isActive,
      emailVerifiedAt: this.emailVerifiedAt,
      lastLoginAt: this.lastLoginAt,
      failedLoginAttempts: this.failedLoginAttempts,
      lockedUntil: this.lockedUntil,
      forcePasswordChange: this.forcePasswordChange,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
