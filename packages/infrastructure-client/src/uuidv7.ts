/**
 * UUIDv7（RFC 9562）を生成する。先頭 48 ビットがミリ秒単位の時刻のため、生成順にほぼ並ぶ。
 * 同一ミリ秒内の順序は保証しない。タスク ID と changeId の採番に使う。
 */
export const uuidv7 = (now: number = Date.now()): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
