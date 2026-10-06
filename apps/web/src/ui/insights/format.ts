const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 10/7(水) の形 */
export const formatDay = (d: Date): string =>
  `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;

/** 先週との差の表示 */
export const formatDelta = (current: number, previous: number, unit: string): string => {
  const diff = current - previous;
  if (diff === 0) return "先週と同じ";
  return `先週より ${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} ${unit}`;
};
