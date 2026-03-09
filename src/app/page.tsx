'use client';

import React, { useState } from 'react';
import { useXApi } from '@/context/XApiContext';
import { buildTweetsCsv } from '@/utils/csvUtils';
import { Settings, Search, Download, Calendar, User, AlertCircle, Loader2, X } from 'lucide-react';

export default function Home() {
  const { bearerToken, setBearerToken, userAuth, setUserAuth, isLoading, error, searchTweets, getTweetCount, getAuthenticatedUser, clearError } = useXApi();

  // Search state
  const [username, setUsername] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [keywords, setKeywords] = useState('');
  const [maxResultsInput, setMaxResultsInput] = useState('100');
  const [searchType, setSearchType] = useState<'POST' | 'LIKES'>('POST');
  const [excludeRetweets, setExcludeRetweets] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [tempToken, setTempToken] = useState(bearerToken);
  const [tempAuth, setTempAuth] = useState(userAuth);
  const [isEstimating, setIsEstimating] = useState(false);

  // Electron: クライアント側でbodyに余白を適用（静的エクスポートでlayoutのスタイルが反映されない問題の回避）
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      document.body.style.paddingLeft = '64px';
      document.body.style.paddingRight = '64px';
      document.body.style.boxSizing = 'border-box';
      return () => {
        document.body.style.paddingLeft = '';
        document.body.style.paddingRight = '';
        document.body.style.boxSizing = '';
      };
    }
  }, []);

  // Sync temp states when context values are loaded
  React.useEffect(() => {
    setTempToken(bearerToken);
  }, [bearerToken]);

  React.useEffect(() => {
    setTempAuth(userAuth);
  }, [userAuth]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bearerToken) {
      alert('APIキー（Bearer Token）を設定してください。右上、または設定ボタンから入力できます。');
      setShowSettings(true);
      return;
    }

    if (!username) return;

    // Safety check for LIKES: can only search self
    if (searchType === 'LIKES') {
      setIsEstimating(true);
      const authUser = await getAuthenticatedUser();
      setIsEstimating(false);

      if (!authUser || authUser.username.toLowerCase() !== username.toLowerCase()) {
        alert("いいね検索は自分のアカウントのみ利用できます");
        return;
      }
    }

    setIsEstimating(true);
    try {
      // Step 1: Check Tweet Count (For both POST and LIKES)
      const actualCount = await getTweetCount(username, {
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        keywords: keywords || undefined,
        excludeRetweets: excludeRetweets,
        searchType: searchType,
      });
      setIsEstimating(false);

      const maxResultsLimit = parseInt(maxResultsInput) || 1000;
      let displayCount = maxResultsLimit;
      let costNote = '';
      let countLabel = 'スキャン最大件数';

      if (searchType === 'LIKES' && (startTime || endTime || keywords)) {
        countLabel = 'スキャン最大件数';
        costNote = `\n※「いいね」の期間・キーワード指定は、最新から設定件数分をスキャンして抽出するため、ヒット件数に関わらず設定件数分の費用がかかります。`;
      } else {
        countLabel = '取得予定件数';
        if (actualCount !== null) {
          displayCount = Math.min(actualCount, maxResultsLimit);
        }
      }

      const estimatedCost = (displayCount / 100) * 0.07;

      const confirmed = window.confirm(
        `検索を実行しますか？　【API利用料金の見積もり】\n${countLabel}：${displayCount}件\n推定費用：$${estimatedCost.toFixed(2)} 程度\n${costNote}\n\n※見込金額につきましては作者が2026年3月8日に実行したときの金額（100件あたり$0.07）に基づいた目安です。想定以上の金額になっても作者は責任を負いません。`
      );

      if (!confirmed) return;

      const tweets = await searchTweets(username, {
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        keywords: keywords || undefined,
        maxResults: maxResultsLimit,
        searchType: searchType,
        excludeRetweets: excludeRetweets,
      });
      setResults(tweets);
    } catch (err) {
      setIsEstimating(false);
      // Error will be handled by context and displayed in UI
    }
  };

  const handleSaveSettings = () => {
    setBearerToken(tempToken);
    setUserAuth(tempAuth);
    setShowSettings(false);
  };

  const handleClearSettings = () => {
    if (!window.confirm('すべてのAPI設定をクリアします。よろしいですか？')) return;
    setTempToken('');
    setTempAuth({ apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' });
    setBearerToken('');
    setUserAuth({ apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' });
  };

  const handleDownloadCSV = async () => {
    if (results.length === 0) return;

    const csvContent = buildTweetsCsv(results);

    // Electron environment check
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      const result = await (window as any).electronAPI.saveCSV({
        content: csvContent,
        filename: `x_posts_${username || 'export'}.csv`
      });
      if (result.success) {
        alert(`保存しました: ${result.path}`);
      }
    } else {
      // Fallback for browser
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `x_posts_${username || 'export'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 animate-fade-in flex flex-col items-center overflow-x-hidden w-full max-w-[100vw] box-border py-8 md:py-12">
      {/* 
        Outer Container with forced margins:
        - The p-8/p-12 on the main tag above ensures there's ALWAYS a margin.
        - This sub-container handles the width-capping and centering.
      */}
      <div className="w-full flex flex-col items-stretch max-w-[1400px]">
        {/* 
          Standard Title Bar: 
          - Integrated into the flow with forced side margins from parent p-8.
          - Clear space for OS buttons via pl-[120px].
        */}
        <div className="w-full bg-black/98 border border-white/10 rounded-3xl flex flex-col justify-center pl-[120px] pr-10 py-10 min-h-[140px] mb-10" style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tight text-white leading-tight break-words">X投稿検索</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-2 opacity-80">プロフェッショナル検索スイート</p>
          </div>
        </div>

        {/* 
          Main Content:
          - Automatically inherits side margins from the parent p-8.
        */}
        <div className="w-full">
          <header className="flex flex-col gap-3 mb-10 py-6 border-b border-white/5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${bearerToken ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></span>
                <p className={`${bearerToken ? 'font-bold text-slate-500 text-[11px] uppercase tracking-[0.15em]' : 'font-normal text-red-500 text-[20px]'}`}>
                  {bearerToken ? 'API接続済み' : '設定ボタンをクリックして、ベアラートークンなどを設定してください。'}
                </p>
              </div>
              <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <a
                  href="https://forms.gle/jhAGYJ8DJccyjZWHA"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (typeof window !== 'undefined' && 'electronAPI' in window) {
                      e.preventDefault();
                      (window as any).electronAPI.openExternal('https://forms.gle/jhAGYJ8DJccyjZWHA');
                    }
                  }}
                  className="text-[12px] font-medium text-slate-500 hover:text-blue-400 transition-colors underline underline-offset-2"
                >
                  バグ報告・ご意見
                </a>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-200 transition-all border border-slate-700 shadow-sm"
                >
                  <Settings size={18} />
                  <span>設定</span>
                </button>
              </div>
            </div>
          </header>

          {/* Modern Search Console */}
          <section className="glass-panel p-8 mb-8 border border-white/10 shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-300">検索コンソール</h2>
            </div>

            <form onSubmit={handleSearch} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
                {/* Account Input */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                    <User size={12} className="text-blue-500" /> アカウント
                  </label>
                  <input
                    type="text"
                    placeholder="elonmusk"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace('@', ''))}
                    className="w-full focus:ring-2 focus:ring-blue-500/20 active:scale-[0.99]"
                    required
                  />
                </div>

                {/* Type & RT Filter */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                    <Settings size={12} className="text-blue-500" /> 取得タイプ & フィルタ
                  </label>
                  <div className="flex flex-col gap-3 h-full justify-center">
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name="searchType"
                          checked={searchType === 'POST'}
                          onChange={() => setSearchType('POST')}
                          className="w-3.5 h-3.5 accent-blue-500"
                        />
                        <span className={`text-[13px] font-bold transition-colors ${searchType === 'POST' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>投稿</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name="searchType"
                          checked={searchType === 'LIKES'}
                          onChange={() => setSearchType('LIKES')}
                          className="w-3.5 h-3.5 accent-blue-500"
                        />
                        <span className={`text-[13px] font-bold transition-colors ${searchType === 'LIKES' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>いいね（自分のみ）</span>
                      </label>
                    </div>
                    {searchType === 'LIKES' && (
                      <p className="text-[10px] text-red-500 mt-1 leading-tight max-w-[200px] font-bold">
                        ※いいねは自分のアカウントだけ検索できます
                      </p>
                    )}
                    {searchType === 'POST' && (
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={excludeRetweets}
                          onChange={(e) => setExcludeRetweets(e.target.checked)}
                          className="w-3.5 h-3.5 rounded-sm border-slate-700 bg-slate-900 accent-blue-500"
                        />
                        <span className="text-[12px] font-bold text-slate-400 group-hover:text-slate-300">RTを除外する</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Start Date */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-blue-400" /> 抽出開始日 (JST)
                  </label>
                  <input
                    type="date"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        (e.target as any).showPicker?.();
                      } catch (err) {
                        // Ignore errors where browser requires a gesture or doesn't support showPicker
                      }
                    }}
                    className="w-full cursor-pointer hover:bg-white/[0.05] p-2 rounded-lg border border-slate-700 bg-slate-900/50"
                  />
                </div>

                {/* End Date */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-blue-400" /> 抽出終了日 (JST)
                  </label>
                  <input
                    type="date"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        (e.target as any).showPicker?.();
                      } catch (err) {
                        // Ignore errors
                      }
                    }}
                    className="w-full cursor-pointer hover:bg-white/[0.05] p-2 rounded-lg border border-slate-700 bg-slate-900/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                {/* Keywords */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Search size={12} className="text-indigo-400" /> フィルタキーワード
                  </label>
                  <input
                    type="text"
                    placeholder="キーワード（任意）"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pt-6 border-t border-white/5">
                <div className="flex flex-col gap-4">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    最大取得件数
                  </label>
                  <div className="flex flex-wrap gap-5">
                    {[100, 500, 1000].map((val) => (
                      <label key={val} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="maxResults"
                          value={val}
                          checked={parseInt(maxResultsInput) === val}
                          onChange={(e) => setMaxResultsInput(e.target.value)}
                          className="w-3.5 h-3.5 accent-blue-500"
                        />
                        <span className={`text-[13px] font-semibold transition-colors ${parseInt(maxResultsInput) === val ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'}`}>
                          {`${val.toLocaleString()} 件`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isEstimating || !bearerToken}
                  className="btn-primary min-w-[200px] h-12 flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-xl shadow-blue-600/20"
                >
                  {(isLoading || isEstimating) ? <Loader2 className="animate-spin" size={20} /> : <Search size={18} strokeWidth={2.5} />}
                  <span className="font-bold tracking-tight">{(isLoading || isEstimating) ? (isEstimating ? '件数確認中...' : '検索実行中...') : '検索を開始する'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Error Toast */}
          {error && (
            <div className="flex items-start gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-8 animate-shake">
              <AlertCircle className="text-red-500 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-400">エラー</p>
                <p className="text-xs text-red-300 opacity-80 mt-1">{error}</p>
              </div>
              <button onClick={clearError} className="text-slate-500 hover:text-white transition-colors">
                <AlertCircle size={16} />
              </button>
            </div>
          )}

          {/* Professional Data Table */}
          {(isLoading || results.length > 0) && (
            <section className="glass-panel overflow-hidden border border-white/5 shadow-2xl">
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-white tracking-tight flex items-center gap-3">
                    抽出結果
                    {results.length > 0 && (
                      <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/10">
                        {results.length} 件
                      </span>
                    )}
                  </h2>
                </div>
                {results.length > 0 && (
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all text-xs font-bold shadow-lg shadow-emerald-900/40"
                  >
                    <Download size={14} strokeWidth={3} />
                    <span>CSVエクスポート</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                {results.length > 0 ? (
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-white/[0.01]">
                        <th className="p-4 px-6 text-[10px] uppercase font-black tracking-widest text-slate-500 w-[200px] border-b border-white/5">投稿日時</th>
                        <th className="p-4 px-6 text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">コンテンツ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {results.map((tweet) => (
                        <tr key={tweet.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="p-4 px-6 text-[11px] text-slate-400 align-top font-medium tracking-tight">
                            {new Date(tweet.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                          </td>
                          <td className="p-4 px-6 text-[13px] text-slate-300 align-top leading-relaxed group-hover:text-white transition-colors">
                            {tweet.text}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-32 flex flex-col items-center justify-center text-center px-10">
                    {isLoading ? (
                      <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                          <div className="w-16 h-16 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                          <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500" size={20} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-300 font-bold">データを取得中...</p>
                          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">X API処理中</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 opacity-40">
                        <div className="w-16 h-16 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center">
                          <Search size={32} className="text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Settings Modal - High Visibility Design */}
          {showSettings && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden" style={{ margin: 64 }}>
                {/* Header */}
                <div className="flex items-center justify-between px-10 py-5 border-b border-slate-700/50">
                  <h3 className="text-lg font-bold text-white">設定</h3>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="p-2 -m-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
                    title="閉じる"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-10 py-6">
                  {/* Important Notice */}
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
                    <p className="text-[12px] font-bold text-red-400 mb-2">注意</p>
                    <ul className="space-y-1 text-[13px] text-red-300 leading-relaxed list-disc list-inside">
                      <li>予期せぬAPI請求を防ぐため、X Developer PortalのAPI支出上限を設定することを強くお勧めします。</li>
                      <li>ベアラートークン、コンシューマーキーなどはローカルに保存されますので、管理には気をつけてください。</li>
                    </ul>
                  </div>

                  {/* 余白 */}
                  <div style={{ height: 15, minHeight: 15 }} aria-hidden />

                  {/* Bearer Token */}
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">投稿検索用<span className="text-red-500">（必須）</span></h4>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">ベアラートークン</label>
                    <input
                      type="password"
                      placeholder="Bearer Token を入力"
                      value={tempToken}
                      onChange={(e) => setTempToken(e.target.value)}
                      className="w-full text-sm p-3.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                    />
                  </div>

                  {/* 余白 */}
                  <div style={{ height: 15, minHeight: 15 }} aria-hidden />

                  {/* OAuth Keys */}
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">いいね検索用</h4>
                    <p className="text-[12px] text-slate-400 mb-4">4項目すべて入力が必要です</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[13px] font-medium text-slate-300 mb-1.5">コンシューマーキー</label>
                        <input
                          type="password"
                          placeholder="API Key"
                          value={tempAuth.apiKey}
                          onChange={(e) => setTempAuth({ ...tempAuth, apiKey: e.target.value })}
                          className="w-full text-sm p-3.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-slate-300 mb-1.5">コンシューマーキーシークレット</label>
                        <input
                          type="password"
                          placeholder="API Key Secret"
                          value={tempAuth.apiSecret}
                          onChange={(e) => setTempAuth({ ...tempAuth, apiSecret: e.target.value })}
                          className="w-full text-sm p-3.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-slate-300 mb-1.5">アクセストークン</label>
                        <input
                          type="password"
                          placeholder="Access Token"
                          value={tempAuth.accessToken}
                          onChange={(e) => setTempAuth({ ...tempAuth, accessToken: e.target.value })}
                          className="w-full text-sm p-3.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-slate-300 mb-1.5">アクセストークンシークレット</label>
                        <input
                          type="password"
                          placeholder="Access Token Secret"
                          value={tempAuth.accessTokenSecret}
                          onChange={(e) => setTempAuth({ ...tempAuth, accessTokenSecret: e.target.value })}
                          className="w-full text-sm p-3.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 余白 */}
                  <div style={{ height: 15, minHeight: 15 }} aria-hidden />

                  {/* Setup Guide */}
                  <div>
                    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-4">
                      <h4 className="text-sm font-bold text-white mb-3">設定方法</h4>
                    <ol className="space-y-2 text-[13px] text-slate-300 leading-relaxed">
                      <li>1. <button type="button" onClick={() => (window as any).electronAPI?.openExternal('https://developer.twitter.com/en/portal/dashboard')} className="text-blue-400 hover:text-blue-300 underline">X Developer Console</button>にログイン</li>
                      <li>2. ダッシュボードでクレジットを購入 (フリープランではXの検索はできません)</li>
                      <li>3. アプリ {'>'} 該当のアプリをクリック (または新規にアプリ作成)</li>
                      <li>4. ベアラートークン等をコピーしてこの設定画面の該当箇所にペースト</li>
                    </ol>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3" style={{ marginTop: 15 }}>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowSettings(false)}
                        className="flex-1 py-3.5 text-sm font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        className="flex-1 py-3.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors active:scale-[0.98]"
                      >
                        設定を保存
                      </button>
                    </div>
                    <button
                      onClick={handleClearSettings}
                      type="button"
                      className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-red-400 border border-slate-600 hover:border-red-500/50 rounded-lg transition-colors"
                    >
                      設定をクリア
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
