/**
 * JST 基準の日付変換ユーティリティ
 * X API の start_time / end_time パラメータ用
 */

/** 日付文字列 YYYY-MM-DD を JST 00:00 として UTC ISO に変換（API用） */
export function toJSTStartISO(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00+09:00').toISOString();
}

/**
 * 日付文字列 YYYY-MM-DD の翌日 JST 00:00 を UTC ISO に変換（end_time 用・exclusive）
 * capToNow: 未来の場合は現在時刻にキャップ（APIが未来の end_time を拒否するため）
 */
export function toJSTEndISO(dateStr: string, capToNow = true): string {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
  let endISO = d.toISOString();
  if (capToNow) {
    const now = new Date();
    now.setSeconds(now.getSeconds() - 30);
    const nowISO = now.toISOString();
    if (endISO > nowISO) endISO = nowISO;
  }
  return endISO;
}
