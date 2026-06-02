type GroupMember = {
  userId: number;
  joinedAt: number;
  lastSeenAt: number;
};

type Group = {
  code: string;
  createdBy: number;
  createdAt: number;
  expiresAt: number;
  members: Map<number, GroupMember>;
};

const GROUP_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const groups = new Map<string, Group>();
const userToGroup = new Map<number, string>();

const generateCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const cleanupExpiredGroups = () => {
  const now = Date.now();
  for (const [code, group] of groups.entries()) {
    if (group.expiresAt <= now || group.members.size === 0) {
      groups.delete(code);
      for (const memberId of group.members.keys()) {
        userToGroup.delete(memberId);
      }
    }
  }
};

const touchMember = (group: Group, userId: number) => {
  const now = Date.now();
  const existing = group.members.get(userId);
  if (existing) {
    existing.lastSeenAt = now;
  } else {
    group.members.set(userId, {
      userId,
      joinedAt: now,
      lastSeenAt: now,
    });
  }
};

export const createGroup = (userId: number): Group => {
  cleanupExpiredGroups();

  const existingCode = userToGroup.get(userId);
  if (existingCode) {
    const existingGroup = groups.get(existingCode);
    if (existingGroup) {
      touchMember(existingGroup, userId);
      return existingGroup;
    }
  }

  let code = generateCode();
  while (groups.has(code)) {
    code = generateCode();
  }

  const now = Date.now();
  const group: Group = {
    code,
    createdBy: userId,
    createdAt: now,
    expiresAt: now + GROUP_TTL_MS,
    members: new Map(),
  };
  touchMember(group, userId);
  groups.set(code, group);
  userToGroup.set(userId, code);
  return group;
};

export const joinGroup = (userId: number, code: string): Group | null => {
  cleanupExpiredGroups();
  const group = groups.get(code.toUpperCase());
  if (!group) return null;
  if (group.expiresAt <= Date.now()) return null;
  touchMember(group, userId);
  userToGroup.set(userId, group.code);
  return group;
};

export const leaveGroup = (userId: number): void => {
  cleanupExpiredGroups();
  const code = userToGroup.get(userId);
  if (!code) return;
  const group = groups.get(code);
  if (!group) {
    userToGroup.delete(userId);
    return;
  }
  group.members.delete(userId);
  userToGroup.delete(userId);
  if (group.members.size === 0) {
    groups.delete(code);
  }
};

export const getGroupByUser = (userId: number): Group | null => {
  cleanupExpiredGroups();
  const code = userToGroup.get(userId);
  if (!code) return null;
  const group = groups.get(code);
  if (!group || group.expiresAt <= Date.now()) return null;
  touchMember(group, userId);
  return group;
};

export const getGroupByCode = (code: string): Group | null => {
  cleanupExpiredGroups();
  const group = groups.get(code.toUpperCase());
  if (!group || group.expiresAt <= Date.now()) return null;
  return group;
};

export const serializeGroup = (group: Group) => {
  return {
    code: group.code,
    created_by: group.createdBy,
    created_at: new Date(group.createdAt).toISOString(),
    expires_at: new Date(group.expiresAt).toISOString(),
    members: Array.from(group.members.values()).map((m) => ({
      user_id: m.userId,
      joined_at: new Date(m.joinedAt).toISOString(),
      last_seen_at: new Date(m.lastSeenAt).toISOString(),
    })),
  };
};
