export const PRESENCE_POLICY = Object.freeze({
  heartbeatSeconds: 60,
  onlineSeconds: 150,
  writeCooldownSeconds: 45,
  refreshSeconds: 30,
  historyDays: 7,
  pageSize: 10,
});
export const PRESENCE_ROLES = ["worker", "client", "admin"] as const;
export type PresenceRole = typeof PRESENCE_ROLES[number];
