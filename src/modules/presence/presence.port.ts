import type { PresenceQuery } from "./presence.schemas";
import type { PresenceRole } from "./presence.policy";

export type PresenceUser = {
  subject: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  is_online: boolean;
  last_activity_at: string;
  last_connection_at: string | null;
};
export type PresenceGroup = {
  role: PresenceRole;
  page: number;
  page_size: number;
  total: number;
  online: number;
  users: PresenceUser[];
};
export type PresenceSnapshot = { as_of: string; groups: PresenceGroup[] };
export interface PresenceRepository {
  canView: (userId: string) => Promise<boolean>;
  observe: (userId: string) => Promise<boolean>;
  list: (query: PresenceQuery, requesterId: string) => Promise<PresenceSnapshot>;
}
