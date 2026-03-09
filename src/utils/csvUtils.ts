/**
 * CSV エクスポート用ユーティリティ
 */

export function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatTweetRow(tweet: { id: string; created_at: string; text: string; author_id: string }): string {
  return [
    tweet.id,
    new Date(tweet.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    escapeCsvField(tweet.text),
    `https://x.com/${tweet.author_id}/status/${tweet.id}`,
  ].join(',');
}

export function buildTweetsCsv(
  tweets: { id: string; created_at: string; text: string; author_id: string }[]
): string {
  const headers = ['ID', 'Date', 'Text', 'Link'];
  return [headers.join(','), ...tweets.map(formatTweetRow)].join('\n');
}
