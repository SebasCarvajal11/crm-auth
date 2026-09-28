import { sql } from "drizzle-orm";
import type { DbOrTx } from "../users/users.repository";
import type { PresenceRepository, PresenceSnapshot } from "./presence.port";
import { PRESENCE_POLICY } from "./presence.policy";

export const createPresenceRepository = (conn: DbOrTx): PresenceRepository => ({
  canView: async (userId) => {
    const result = await conn.execute<{ allowed: boolean }>(sql`
      SELECT EXISTS (SELECT 1 FROM schema_auth.users u
        WHERE id = ${userId}::uuid AND role = 'admin' AND is_active AND deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM schema_auth.refresh_tokens r
            WHERE r.user_id = u.id AND NOT r.is_revoked AND r.expires_at > now())) AS allowed`);
    return result.rows[0].allowed;
  },
  observe: async (userId) => {
    // Database time and a conditional upsert prevent clock skew and repeated writes across tabs/replicas.
    const result = await conn.execute<{ allowed: boolean }>(sql`
      WITH eligible AS (
        SELECT id FROM schema_auth.users u WHERE id = ${userId}::uuid
          AND is_active AND deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM schema_auth.refresh_tokens r
            WHERE r.user_id = u.id AND NOT r.is_revoked AND r.expires_at > now())
      ), observed AS (
        INSERT INTO schema_auth.user_presence (user_id, last_seen_at)
        SELECT id, now() FROM eligible
        ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()
          WHERE schema_auth.user_presence.last_seen_at < now() - ${PRESENCE_POLICY.writeCooldownSeconds} * interval '1 second'
        RETURNING user_id
      ) SELECT EXISTS (SELECT 1 FROM eligible) AS allowed`);
    return result.rows[0].allowed;
  },
  list: async (query, requesterId) => {
    const needle = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
    // One bounded query returns independent role pages and matching totals from the same snapshot.
    const result = await conn.execute<{ snapshot: PresenceSnapshot }>(sql`
      WITH roles(role, requested_page) AS (
        VALUES ('worker', ${query.worker_page}::int), ('client', ${query.client_page}::int), ('admin', ${query.admin_page}::int)
      ), candidates AS (
        SELECT u.role::text AS role, u.subject, u.email, u.first_name, u.last_name, u.company_name,
          u.last_login_at AS last_connection_at, p.last_seen_at AS last_activity_at,
          (p.last_seen_at > now() - ${PRESENCE_POLICY.onlineSeconds} * interval '1 second'
            AND EXISTS (SELECT 1 FROM schema_auth.refresh_tokens r
              WHERE r.user_id = u.id AND NOT r.is_revoked AND r.expires_at > now())) AS is_online
        FROM schema_auth.user_presence p JOIN schema_auth.users u ON u.id = p.user_id
        WHERE u.is_active AND u.deleted_at IS NULL AND u.id <> ${requesterId}::uuid
          AND p.last_seen_at >= now() - ${PRESENCE_POLICY.historyDays} * interval '1 day'
          AND (${query.q} = '' OR concat_ws(' ', u.email, u.first_name, u.last_name, u.company_name) ILIKE ${needle})
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY role ORDER BY is_online DESC, last_activity_at DESC, subject) AS position
        FROM candidates
      ), totals AS (
        SELECT role, count(*)::int AS total, count(*) FILTER (WHERE is_online)::int AS online FROM candidates GROUP BY role
      ), pages AS (
        SELECT r.role, least(r.requested_page, greatest(1, ceil(coalesce(t.total, 0)::numeric / ${PRESENCE_POLICY.pageSize})::int)) AS page,
          coalesce(t.total, 0) AS total, coalesce(t.online, 0) AS online
        FROM roles r LEFT JOIN totals t USING (role)
      ) SELECT jsonb_build_object('as_of', now(), 'groups', (
        SELECT jsonb_agg(jsonb_build_object('role', p.role, 'page', p.page, 'page_size', ${PRESENCE_POLICY.pageSize},
          'total', p.total, 'online', p.online, 'users', coalesce((
            SELECT jsonb_agg(to_jsonb(r) - 'position' - 'role' ORDER BY r.position)
            FROM ranked r WHERE r.role = p.role AND r.position > (p.page - 1) * ${PRESENCE_POLICY.pageSize}
              AND r.position <= p.page * ${PRESENCE_POLICY.pageSize}
          ), '[]'::jsonb)) ORDER BY CASE p.role WHEN 'worker' THEN 1 WHEN 'client' THEN 2 ELSE 3 END)
        FROM pages p
      )) AS snapshot`);
    return result.rows[0].snapshot;
  },
});
