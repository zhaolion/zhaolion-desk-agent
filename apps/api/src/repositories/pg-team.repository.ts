import { eq, and } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { teams, teamMembers, users } from "../db/schema.js";
import type { TeamRepository } from "@desk-agent/domain/account";
import type {
  Team,
  TeamMember,
  TeamWithMembers,
  CreateTeamInput,
  UpdateTeamInput,
  AddMemberInput,
  UpdateMemberRoleInput,
  TeamRole,
} from "@desk-agent/domain";

export class PgTeamRepository implements TeamRepository {
  constructor(private db: Database) {}

  async create(input: CreateTeamInput): Promise<Team> {
    // Create team and add owner as a member in a transaction
    const result = await this.db.transaction(async (tx) => {
      const [team] = await tx.insert(teams).values({
        name: input.name,
        ownerId: input.ownerId,
      }).returning();

      if (!team) {
        throw new Error("Failed to create team");
      }

      // Add owner as a member with 'owner' role
      await tx.insert(teamMembers).values({
        teamId: team.id,
        userId: input.ownerId,
        role: "owner",
      });

      return team;
    });

    return this.mapToTeam(result);
  }

  async findById(id: string): Promise<Team | null> {
    const [result] = await this.db.select().from(teams).where(eq(teams.id, id));
    return result ? this.mapToTeam(result) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Team[]> {
    const results = await this.db.select().from(teams).where(eq(teams.ownerId, ownerId));
    return results.map(this.mapToTeam);
  }

  async findByUserId(userId: string): Promise<Team[]> {
    const results = await this.db
      .select({ team: teams })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId));

    return results.map((r) => this.mapToTeam(r.team));
  }

  async update(id: string, input: UpdateTeamInput): Promise<Team> {
    const [result] = await this.db.update(teams)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();

    if (!result) {
      throw new Error(`Team not found: ${id}`);
    }

    return this.mapToTeam(result);
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Delete all members first
      await tx.delete(teamMembers).where(eq(teamMembers.teamId, id));
      // Then delete the team
      await tx.delete(teams).where(eq(teams.id, id));
    });
  }

  async findByIdWithMembers(id: string): Promise<TeamWithMembers | null> {
    const team = await this.findById(id);
    if (!team) return null;

    const members = await this.findMembers(id);

    return {
      ...team,
      members,
    };
  }

  async addMember(input: AddMemberInput): Promise<TeamMember> {
    const [result] = await this.db.insert(teamMembers).values({
      teamId: input.teamId,
      userId: input.userId,
      role: input.role ?? "member",
    }).returning();

    if (!result) {
      throw new Error("Failed to add member");
    }

    return this.mapToTeamMember(result);
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.db.delete(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ));
  }

  async updateMemberRole(input: UpdateMemberRoleInput): Promise<TeamMember> {
    const [result] = await this.db.update(teamMembers)
      .set({ role: input.role })
      .where(and(
        eq(teamMembers.teamId, input.teamId),
        eq(teamMembers.userId, input.userId)
      ))
      .returning();

    if (!result) {
      throw new Error("Member not found");
    }

    return this.mapToTeamMember(result);
  }

  async findMembers(teamId: string): Promise<TeamMember[]> {
    const results = await this.db.select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    return results.map(this.mapToTeamMember);
  }

  async findMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const [result] = await this.db.select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ));

    return result ? this.mapToTeamMember(result) : null;
  }

  async isOwner(teamId: string, userId: string): Promise<boolean> {
    const [team] = await this.db.select()
      .from(teams)
      .where(and(
        eq(teams.id, teamId),
        eq(teams.ownerId, userId)
      ));

    return !!team;
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    const member = await this.findMember(teamId, userId);
    return !!member;
  }

  async getMemberRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const member = await this.findMember(teamId, userId);
    return member?.role ?? null;
  }

  private mapToTeam(row: typeof teams.$inferSelect): Team {
    return {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToTeamMember(row: typeof teamMembers.$inferSelect): TeamMember {
    return {
      teamId: row.teamId,
      userId: row.userId,
      role: row.role as TeamRole,
      joinedAt: row.joinedAt,
    };
  }
}
