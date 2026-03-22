/** Kill switches — set env var to "true" to disable the feature */

export function isSnapshotEnabled(): boolean {
  return process.env.KILL_SNAPSHOTS !== "true";
}
