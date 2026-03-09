'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toJSTStartISO, toJSTEndISO } from '@/utils/dateUtils';

interface XTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
}

interface XApiContextType {
  bearerToken: string;
  setBearerToken: (token: string) => void;
  userAuth: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  };
  setUserAuth: (auth: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string; }) => void;
  isLoading: boolean;
  error: string | null;
  searchTweets: (username: string, options: {
    startTime?: string;
    endTime?: string;
    keywords?: string;
    maxResults?: number;
    searchType?: 'POST' | 'LIKES';
    excludeRetweets?: boolean;
  }) => Promise<XTweet[]>;
  getTweetCount: (username: string, options: {
    startTime?: string;
    endTime?: string;
    keywords?: string;
    excludeRetweets?: boolean;
    searchType?: 'POST' | 'LIKES';
  }) => Promise<number | null>;
  getAuthenticatedUser: () => Promise<{ username: string; id: string } | null>;
  clearError: () => void;
}

const XApiContext = createContext<XApiContextType | undefined>(undefined);

export const XApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bearerToken, setBearerTokenState] = useState<string>('');
  const [userAuth, setUserAuthState] = useState({
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    accessTokenSecret: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('x_bearer_token');
    if (savedToken) setBearerTokenState(savedToken);

    const savedAuth = localStorage.getItem('x_user_auth');
    if (savedAuth) {
      try {
        setUserAuthState(JSON.parse(savedAuth));
      } catch (e) {
        console.error('Failed to parse user auth', e);
      }
    }
  }, []);

  const setBearerToken = (token: string) => {
    setBearerTokenState(token);
    localStorage.setItem('x_bearer_token', token);
  };

  const setUserAuth = (auth: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string; }) => {
    setUserAuthState(auth);
    localStorage.setItem('x_user_auth', JSON.stringify(auth));
  };

  const clearError = () => setError(null);

  const getAuthenticatedUser = async () => {
    try {
      const data = await makeRequest('https://api.twitter.com/2/users/me', true);
      if (data?.data) {
        return {
          username: data.data.username,
          id: data.data.id
        };
      }
      return null;
    } catch (err) {
      console.error('Failed to fetch authenticated user', err);
      return null;
    }
  };

  const makeRequest = async (url: string, useUserAuth = false) => {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      const authOptions = useUserAuth ? { userAuth } : { token: bearerToken };
      const res = await (window as any).electronAPI.xApiRequest({ url, ...authOptions });
      if (res.error || (res.status && res.status >= 400)) {
        const detail = res.data?.detail || res.error || `APIリクエストに失敗しました (Status: ${res.status})`;
        throw new Error(detail);
      }
      return res.data;
    } else {
      throw new Error('Electron環境ではありません。デスクトップアプリとして起動してください。');
    }
  };

  const getTweetCount = async (username: string, options: {
    startTime?: string;
    endTime?: string;
    keywords?: string;
    excludeRetweets?: boolean;
    searchType?: 'POST' | 'LIKES';
  }): Promise<number | null> => {
    if (!bearerToken) return null;

    try {
      if (options.searchType === 'LIKES') {
        // If filters are applied, we can't get an accurate count without fetching everything.
        // To avoid excessive API calls just for counting, we return null.
        // The UI will then use the user-selected maxResults for cost estimation.
        if (options.startTime || options.endTime || options.keywords) {
          return null;
        }

        // For Likes without filters, we can show the total from user metrics
        const userData = await makeRequest(`https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`);
        return userData.data?.public_metrics?.like_count ?? 0;
      }

      // For Posts, use the counts endpoint
      const queryParams = new URLSearchParams();
      let query = `from:${username}`;
      if (options.keywords) {
        query += ` ${options.keywords}`;
      }
      if (options.excludeRetweets) {
        query += ` -is:retweet`;
      }
      queryParams.append('query', query);
      if (options.startTime) queryParams.append('start_time', toJSTStartISO(options.startTime));
      if (options.endTime) queryParams.append('end_time', toJSTEndISO(options.endTime));

      const data = await makeRequest(`https://api.twitter.com/2/tweets/counts/all?${queryParams.toString()}`);
      return data.meta?.total_tweet_count ?? 0;
    } catch (err: any) {
      console.error('Count error:', err);
      return null;
    }
  };

  const searchTweets = async (username: string, options: {
    startTime?: string;
    endTime?: string;
    keywords?: string;
    maxResults?: number;
    searchType?: 'POST' | 'LIKES';
    excludeRetweets?: boolean;
  }): Promise<XTweet[]> => {
    if (!bearerToken) {
      setError('API Bearer Token が設定されていません。設定画面から入力してください。');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get User ID from username
      const userData = await makeRequest(`https://api.twitter.com/2/users/by/username/${username}`);
      if (!userData?.data?.id) {
        throw new Error('ユーザーが見つかりませんでした。アカウント名を確認してください。');
      }
      const userId = userData.data.id;

      let allTweets: XTweet[] = [];
      let nextToken: string | undefined = undefined;
      const MAX_TOTAL_RESULTS = options.maxResults || 5000;

      if (options.searchType === 'LIKES') {
        // Fetch Liked Tweets (Note: liked_tweets endpoint has different pagination and less filters)
        const queryParams = new URLSearchParams();
        queryParams.append('tweet.fields', 'created_at,text,author_id');
        queryParams.append('max_results', '100'); // max is 100 per request

        let rawFetchedCount = 0;
        const isFiltering = !!(options.startTime || options.endTime || options.keywords);
        let consecutiveOlderThanStart = 0;

        do {
          if (nextToken) queryParams.set('pagination_token', nextToken);
          // Use User Auth if keys are provided
          const useUserAuth = !!(userAuth.apiKey && userAuth.apiSecret && userAuth.accessToken && userAuth.accessTokenSecret);
          const response = await makeRequest(`https://api.twitter.com/2/users/${userId}/liked_tweets?${queryParams.toString()}`, useUserAuth);

          if (response.data) {
            const fetchedBatch = response.data;
            rawFetchedCount += fetchedBatch.length;

            let filteredBatch = fetchedBatch;

            // Manual filtering for LIKES as API doesn't support them（日付は JST 基準）
            if (isFiltering) {
              const startThreshold = options.startTime ? new Date(toJSTStartISO(options.startTime)) : null;
              const endThreshold = options.endTime ? new Date(toJSTEndISO(options.endTime, false)) : null;

              filteredBatch = fetchedBatch.filter((t: any) => {
                const tweetDate = new Date(t.created_at);

                // Chronological check: if we see many tweets much older than startTime, we might want to stop
                if (startThreshold && tweetDate < startThreshold) {
                  consecutiveOlderThanStart++;
                } else {
                  consecutiveOlderThanStart = 0;
                }

                if (startThreshold && tweetDate < startThreshold) return false;
                if (endThreshold && tweetDate >= endThreshold) return false;
                if (options.keywords) {
                  const kws = options.keywords.toLowerCase().split(/\s+/);
                  const text = t.text.toLowerCase();
                  if (!kws.every(kw => text.includes(kw))) return false;
                }
                return true;
              });
            }

            allTweets = [...allTweets, ...filteredBatch];
          }

          nextToken = response.meta?.next_token;

          // CRITICAL: Stop condition for LIKES
          // 1. If we have no more pages
          // 2. OR if we reached the requested result count
          // 3. OR if we are filtering and have fetched more than MAX_TOTAL_RESULTS raw items (to cap cost)
          // 4. OR if we've seen a large consecutive block of tweets older than our startTime

          if (!nextToken) break;
          if (allTweets.length >= MAX_TOTAL_RESULTS) break;

          // Cost protection: If filtering, don't fetch more than the 'max results' setting in raw items.
          // This ensures that choosing '100件' always costs at most 1 API request worth ($0.55).
          if (isFiltering && rawFetchedCount >= MAX_TOTAL_RESULTS) break;

          // Time protection: If we've seen 200+ tweets older than our start window, stop.
          if (options.startTime && consecutiveOlderThanStart >= 200) break;

        } while (nextToken);

        // Final slice to respect maxResults
        allTweets = allTweets.slice(0, MAX_TOTAL_RESULTS);

      } else {
        // Fetch Posts (Search All)
        const queryParams = new URLSearchParams();
        queryParams.append('tweet.fields', 'created_at,text,author_id');
        queryParams.append('max_results', Math.min(MAX_TOTAL_RESULTS, 500).toString());

        let query = `from:${username}`;
        if (options.keywords) {
          query += ` ${options.keywords}`;
        }
        if (options.excludeRetweets) {
          query += ` -is:retweet`;
        }
        queryParams.append('query', query);

        if (options.startTime) queryParams.append('start_time', toJSTStartISO(options.startTime));
        if (options.endTime) queryParams.append('end_time', toJSTEndISO(options.endTime));

        do {
          if (nextToken) queryParams.set('next_token', nextToken);
          const remaining = MAX_TOTAL_RESULTS - allTweets.length;
          if (remaining < 500) queryParams.set('max_results', Math.max(remaining, 10).toString());

          const response = await makeRequest(`https://api.twitter.com/2/tweets/search/all?${queryParams.toString()}`);
          if (response.data) allTweets = [...allTweets, ...response.data];
          nextToken = response.meta?.next_token;
        } while (nextToken && allTweets.length < MAX_TOTAL_RESULTS);
      }

      return allTweets;
    } catch (err: any) {
      if (err.message?.includes('Forbidden') || err.message?.includes('Application-Only is forbidden')) {
        setError('「いいね」検索にはユーザー認証（OAuth 1.0a/2.0 User Context）が必要です。Bearer Tokenのみでは取得できません。');
      } else {
        setError(err.message || '予期せぬエラーが発生しました。');
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <XApiContext.Provider value={{
      bearerToken,
      setBearerToken,
      userAuth,
      setUserAuth,
      isLoading,
      error,
      searchTweets,
      getTweetCount,
      getAuthenticatedUser,
      clearError
    }}>
      {children}
    </XApiContext.Provider>
  );
};

export const useXApi = () => {
  const context = useContext(XApiContext);
  if (context === undefined) {
    throw new Error('useXApi must be used within an XApiProvider');
  }
  return context;
};
