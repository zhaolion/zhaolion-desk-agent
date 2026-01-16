import type {
  Team,
  TeamMember,
  TeamWithMembers,
  CreateTeamInput,
  UpdateTeamInput,
  AddMemberInput,
  UpdateMemberRoleInput,
  TeamRole,
} from "../entity/team.js";

export interface TeamRepository {
  // Team CRUD
  create(input: CreateTeamInput): Promise<Team>;
  findById(id: string): Promise<Team | null>;
  findByOwnerId(ownerId: string): Promise<Team[]>;
  findByUserId(userId: string): Promise<Team[]>;
  update(id: string, input: UpdateTeamInput): Promise<Team>;
  delete(id: string): Promise<void>;

  // Team with members
  findByIdWithMembers(id: string): Promise<TeamWithMembers | null>;

  // Member management
  addMember(input: AddMemberInput): Promise<TeamMember>;
  removeMember(teamId: string, userId: string): Promise<void>;
  updateMemberRole(input: UpdateMemberRoleInput): Promise<TeamMember>;
  findMembers(teamId: string): Promise<TeamMember[]>;
  findMember(teamId: string, userId: string): Promise<TeamMember | null>;

  // Permission helpers
  isOwner(teamId: string, userId: string): Promise<boolean>;
  isMember(teamId: string, userId: string): Promise<boolean>;
  getMemberRole(teamId: string, userId: string): Promise<TeamRole | null>;
}
