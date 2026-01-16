export type TeamRole = "owner" | "admin" | "member";

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export interface CreateTeamInput {
  name: string;
  ownerId: string;
}

export interface UpdateTeamInput {
  name?: string;
}

export interface AddMemberInput {
  teamId: string;
  userId: string;
  role?: TeamRole;
}

export interface UpdateMemberRoleInput {
  teamId: string;
  userId: string;
  role: TeamRole;
}
