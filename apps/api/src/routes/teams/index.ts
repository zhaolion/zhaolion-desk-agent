import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { TeamRepository } from "@desk-agent/domain/account";
import type { Team, TeamMember, TeamWithMembers, TeamRole } from "@desk-agent/domain";

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export function createTeamsRoutes(repository: TeamRepository): Hono {
  const routes = new Hono();

  // GET /teams - List user's teams
  routes.get("/", async (c) => {
    const auth = c.get("auth");
    const teams = await repository.findByUserId(auth.userId);
    return c.json(teams.map(serializeTeam));
  });

  // POST /teams - Create team
  routes.post("/", zValidator("json", createTeamSchema), async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");

    const team = await repository.create({
      name: body.name,
      ownerId: auth.userId,
    });

    return c.json(serializeTeam(team), 201);
  });

  // GET /teams/:id - Get team with members
  routes.get("/:id", async (c) => {
    const auth = c.get("auth");
    const teamId = c.req.param("id");

    // Check if user is a member
    const isMember = await repository.isMember(teamId, auth.userId);
    if (!isMember) {
      return c.json({ error: "Team not found" }, 404);
    }

    const team = await repository.findByIdWithMembers(teamId);
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }

    return c.json(serializeTeamWithMembers(team));
  });

  // PATCH /teams/:id - Update team (owner/admin only)
  routes.patch("/:id", zValidator("json", updateTeamSchema), async (c) => {
    const auth = c.get("auth");
    const teamId = c.req.param("id");
    const body = c.req.valid("json");

    // Check permissions
    const role = await repository.getMemberRole(teamId, auth.userId);
    if (!role || (role !== "owner" && role !== "admin")) {
      return c.json({ error: "Permission denied" }, 403);
    }

    const team = await repository.update(teamId, body);
    return c.json(serializeTeam(team));
  });

  // DELETE /teams/:id - Delete team (owner only)
  routes.delete("/:id", async (c) => {
    const auth = c.get("auth");
    const teamId = c.req.param("id");

    // Check if owner
    const isOwner = await repository.isOwner(teamId, auth.userId);
    if (!isOwner) {
      return c.json({ error: "Permission denied" }, 403);
    }

    await repository.delete(teamId);
    return c.json({ success: true });
  });

  // GET /teams/:id/members - List members
  routes.get("/:id/members", async (c) => {
    const auth = c.get("auth");
    const teamId = c.req.param("id");

    // Check if user is a member
    const isMember = await repository.isMember(teamId, auth.userId);
    if (!isMember) {
      return c.json({ error: "Team not found" }, 404);
    }

    const members = await repository.findMembers(teamId);
    return c.json(members.map(serializeMember));
  });

  // POST /teams/:id/members - Add member (owner/admin only)
  routes.post("/:id/members", zValidator("json", addMemberSchema), async (c) => {
    const auth = c.get("auth");
    const teamId = c.req.param("id");
    const body = c.req.valid("json");

    // Check permissions
    const role = await repository.getMemberRole(teamId, auth.userId);
    if (!role || (role !== "owner" && role !== "admin")) {
      return c.json({ error: "Permission denied" }, 403);
    }

    // Check if already a member
    const existingMember = await repository.findMember(teamId, body.userId);
    if (existingMember) {
      return c.json({ error: "User is already a member" }, 400);
    }

    const member = await repository.addMember({
      teamId,
      userId: body.userId,
      role: body.role as TeamRole,
    });

    return c.json(serializeMember(member), 201);
  });

  // PATCH /teams/:id/members/:userId - Update member role (owner/admin only)
  routes.patch("/:id/members/:userId", zValidator("json", updateMemberRoleSchema), async (c) => {
    const auth = c.get("auth");
    const teamId = c.req.param("id");
    const targetUserId = c.req.param("userId");
    const body = c.req.valid("json");

    // Check permissions
    const role = await repository.getMemberRole(teamId, auth.userId);
    if (!role || (role !== "owner" && role !== "admin")) {
      return c.json({ error: "Permission denied" }, 403);
    }

    // Cannot change owner's role
    const isTargetOwner = await repository.isOwner(teamId, targetUserId);
    if (isTargetOwner) {
      return c.json({ error: "Cannot change owner's role" }, 400);
    }

    // Admins cannot change other admins
    const targetRole = await repository.getMemberRole(teamId, targetUserId);
    if (role === "admin" && targetRole === "admin") {
      return c.json({ error: "Admins cannot modify other admins" }, 403);
    }

    const member = await repository.updateMemberRole({
      teamId,
      userId: targetUserId,
      role: body.role as TeamRole,
    });

    return c.json(serializeMember(member));
  });

  // DELETE /teams/:id/members/:userId - Remove member (owner/admin only, or self)
  routes.delete("/:id/members/:userId", async (c) => {
    const auth = c.get("auth");
    const teamId = c.req.param("id");
    const targetUserId = c.req.param("userId");

    // Users can remove themselves
    const isSelf = auth.userId === targetUserId;

    if (!isSelf) {
      // Check permissions
      const role = await repository.getMemberRole(teamId, auth.userId);
      if (!role || (role !== "owner" && role !== "admin")) {
        return c.json({ error: "Permission denied" }, 403);
      }
    }

    // Cannot remove owner
    const isTargetOwner = await repository.isOwner(teamId, targetUserId);
    if (isTargetOwner) {
      return c.json({ error: "Cannot remove team owner" }, 400);
    }

    await repository.removeMember(teamId, targetUserId);
    return c.json({ success: true });
  });

  return routes;
}

function serializeTeam(team: Team): Record<string, unknown> {
  return {
    ...team,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

function serializeMember(member: TeamMember): Record<string, unknown> {
  return {
    ...member,
    joinedAt: member.joinedAt.toISOString(),
  };
}

function serializeTeamWithMembers(team: TeamWithMembers): Record<string, unknown> {
  return {
    ...serializeTeam(team),
    members: team.members.map(serializeMember),
  };
}
