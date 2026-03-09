import { describe, it, expect } from 'vitest';
import { escapeCsvField, formatTweetRow, buildTweetsCsv } from './csvUtils';

describe('escapeCsvField', () => {
  it('通常の文字列をダブルクォートで囲む', () => {
    expect(escapeCsvField('hello')).toBe('"hello"');
  });

  it('ダブルクォートをエスケープする', () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it('改行を含む文字列をエスケープする', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('formatTweetRow', () => {
  it('ツイートをCSV行形式に変換する', () => {
    const tweet = {
      id: '123',
      created_at: '2026-03-08T12:00:00.000Z',
      text: 'Hello world',
      author_id: 'user1',
    };
    const row = formatTweetRow(tweet);
    expect(row).toContain('123');
    expect(row).toContain('"Hello world"');
    expect(row).toContain('https://x.com/user1/status/123');
  });
});

describe('buildTweetsCsv', () => {
  it('複数ツイートからCSV文字列を生成する', () => {
    const tweets = [
      { id: '1', created_at: '2026-03-08T12:00:00.000Z', text: 'First', author_id: 'u1' },
      { id: '2', created_at: '2026-03-08T13:00:00.000Z', text: 'Second', author_id: 'u2' },
    ];
    const csv = buildTweetsCsv(tweets);
    expect(csv).toMatch(/^ID,Date,Text,Link/);
    expect(csv.split('\n').length).toBe(3);
  });

  it('空配列でヘッダーのみのCSVを生成する', () => {
    const csv = buildTweetsCsv([]);
    expect(csv).toBe('ID,Date,Text,Link');
  });
});
