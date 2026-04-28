import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import logo from './assets/appstore.png'

const providerLabels = {
  bkash: 'bKash',
  nagad: 'NAGAD',
  rocket: 'Rocket',
  upay: 'Upay'
}

const providerAccent = {
  bkash: 'from-rose-500 to-rose-600',
  nagad: 'from-orange-500 to-orange-600',
  rocket: 'from-amber-500 to-amber-600',
  upay: 'from-emerald-500 to-emerald-600'
}

const providerAccount = {
  bkash: '01700123456',
  nagad: '01521412457',
  rocket: '01234567890',
  upay: '01800123456'
}

function useQuery() {
  const { search } = useLocation()
  return React.useMemo(() => new URLSearchParams(search), [search])
}

export default function App() {
  const { provider: rawProvider, id } = useParams()
  const provider = (rawProvider || '').toLowerCase()
  const niceProvider = providerLabels[provider] || rawProvider
  const q = useQuery()
  const amountQuery = q.get('amount')
  const [dynamic, setDynamic] = React.useState({
    loading: true,
    error: null,
    status: null,
    accountNumber: null,
    amount: null,
    pageContent: null,
    providerDisplay: null,
    gateway: null,
    expiresAt: null
  })

  const [txid, setTxid] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const [verifying, setVerifying] = React.useState({ running: false, tries: 0, status: 'idle', message: '' })
  const [redirectInfo, setRedirectInfo] = React.useState({ url: null, secondsLeft: 0 })
  const [expiry, setExpiry] = React.useState({ expired: false, secondsLeft: null })
  const [pendingCountdown, setPendingCountdown] = React.useState(0)
  const account = dynamic.accountNumber || providerAccount[provider] || providerAccount.nagad
  const amount = dynamic.amount || amountQuery || '30.00'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(account)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  const verifyOnce = React.useCallback(async () => {
    try {
      const res = await fetch(`https://api.oraclepay.org/api/external/verify/${provider}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trxid: txid })
      })
      const data = await res.json()
      return { ok: res.ok, data }
    } catch (e) {
      return { ok: false, data: { success: false, code: 'NETWORK', message: 'নেটওয়ার্ক সমস্যা' } }
    }
  }, [provider, id, txid])

  const handleVerify = async () => {
    if (!txid || txid.trim().length < 3) {
      setVerifying({ running: false, tries: 0, status: 'error', message: 'সঠিক ট্রান্সজেকশন আইডি লিখুন' })
      return
    }
    setVerifying({ running: true, tries: 0, status: 'pending', message: 'ভেরিফাই করা হচ্ছে…' })
    setPendingCountdown(20)

    let cancelled = false
    // stop if component unmounts
    const cleanup = () => { cancelled = true }
    // attach temporary cleanup to window to ensure we can cancel if needed
    // will be a no-op on normal flow
    const maxTries = 10 // 20s window, every 2s
    for (let i = 0; i < maxTries; i++) {
      if (cancelled) break
      const { ok, data } = await verifyOnce()
      if (cancelled) break

      if (ok && data?.success && data?.code === 'VERIFIED') {
        // Show success overlay and schedule redirect (3s) if destination provided
        const dom = data?.domain?.allowedDomains?.[0]
        setVerifying({ running: false, tries: i + 1, status: 'success', message: 'পেমেন্ট ভেরিফাইড হয়েছে ✅' })
        setPendingCountdown(0)
        if (dom) {
          let target = dom
          if (!/^https?:\/\//i.test(target)) target = `https://${target}`
          setRedirectInfo({ url: target, secondsLeft: 3 })
        }
        return cleanup()
      }

      // Continue polling only if still pending/not found
      if (ok && data?.code === 'PENDING') {
        setVerifying({ running: true, tries: i + 1, status: 'pending', message: 'ট্রান্সজেকশন খোঁজা হচ্ছে…' })
        await new Promise(r => setTimeout(r, 2000))
        continue
      }

      // Hard stop on mismatch/expired/other errors
      const msg = data?.message || 'ভেরিফাই করা যায়নি'
      setVerifying({ running: false, tries: i + 1, status: 'error', message: msg })
      setPendingCountdown(0)
      return cleanup()
    }

    // Timed out after 20s
    setVerifying({ running: false, tries: 10, status: 'error', message: 'সময় শেষ — পরে আবার চেষ্টা করুন' })
    setPendingCountdown(0)
  }

  // Handle auto-redirect countdown after success
  React.useEffect(() => {
    if (!redirectInfo.url || redirectInfo.secondsLeft <= 0) return
    let intervalId = null
    let timeoutId = null
    intervalId = setInterval(() => {
      setRedirectInfo((r) => {
        if (!r.url) return r
        const next = Math.max(0, (r.secondsLeft || 0) - 1)
        return { ...r, secondsLeft: next }
      })
    }, 1000)
    timeoutId = setTimeout(() => {
      try { window.location.assign(redirectInfo.url) } catch (_) {}
      setTimeout(() => { try { window.open('', '_self'); window.close() } catch (_) {} }, 200)
    }, redirectInfo.secondsLeft * 1000)
    return () => {
      if (intervalId) clearInterval(intervalId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [redirectInfo.url, redirectInfo.secondsLeft])

  // Countdown timer for pending overlay (20s total)
  React.useEffect(() => {
    if (verifying.status !== 'pending' || pendingCountdown <= 0) return
    const id = setInterval(() => {
      setPendingCountdown((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [verifying.status, pendingCountdown])

  // Session expiry watcher based on expiresAt
  React.useEffect(() => {
    if (!dynamic.expiresAt) {
      setExpiry({ expired: false, secondsLeft: null })
      return
    }
    const target = new Date(dynamic.expiresAt).getTime()
    const tick = () => {
      const now = Date.now()
      const diff = Math.max(0, target - now)
      if (diff <= 0) {
        setExpiry({ expired: true, secondsLeft: 0 })
      } else {
        setExpiry({ expired: false, secondsLeft: Math.ceil(diff / 1000) })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [dynamic.expiresAt])

  // Fetch dynamic data from backend resolve endpoint
  React.useEffect(() => {
    let alive = true
    async function run() {
      setDynamic(d => ({ ...d, loading: true, error: null }))
      try {
        const res = await fetch(`https://api.oraclepay.org/api/external/resolve/${provider}/${id}`)
        const data = await res.json()
        if (!alive) return

        if (!data.success) {
          const msg = data.message || 'লিংকটি অবৈধ বা মেয়াদ উত্তীর্ণ হয়েছে'

          // যেকোনো success: false হলেই তৎক্ষণাৎ পিছনে যাবে (যদি history থাকে)
          if (window.history.length > 1) {
            window.history.back()
            return
          }

          // history না থাকলে এরর দেখাবে
          setDynamic({
            loading: false,
            error: msg,
            status: res.status || 400,
            accountNumber: null,
            amount: null,
            pageContent: null,
            providerDisplay: null,
            gateway: null,
            expiresAt: null
          })
          return
        }

        // success: true হলে তবেই ডাটা দেখাবে
        setDynamic({
          loading: false,
          error: null,
          status: res.status || 200,
          accountNumber: data.accountNumber,
          amount: data.amount,
          pageContent: data.pageContent || null,
          providerDisplay: data.providerDisplay || niceProvider,
          gateway: data.gateway || null,
          expiresAt: data.expiresAt || null
        })
      } catch (e) {
        if (!alive) return

        // নেটওয়ার্ক বা ফেচ এরর হলেও পিছনে যাবে
        if (window.history.length > 1) {
          window.history.back()
          return
        }

        setDynamic({
          loading: false,
          error: 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না',
          status: null,
          accountNumber: null,
          amount: null,
          pageContent: null,
          providerDisplay: null,
          gateway: null,
          expiresAt: null
        })
      }
    }
    run()
    return () => { alive = false }
  }, [provider, id])

  // যদি এরর থাকে এবং loading না থাকে → বড় লাল এরর দেখাবে
  if (dynamic.error && !dynamic.loading) {
    return (
      <div className="min-h-screen w-full bg-red-600 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-4">⚠️</div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
            লিংকটি অবৈধ বা মেয়াদ উত্তীর্ণ
          </h1>
          <p className="text-white text-opacity-90 text-lg mb-8 px-4">
            {dynamic.error}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'}
              className="px-8 py-4 bg-white text-red-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition"
            >
              পিছনে যান
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-8 py-4 bg-white text-red-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition"
            >
              হোমে যান
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-sky-50 p-3 flex items-center justify-center">
      <div className="w-full max-w-2xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-md p-4 md:p-6">
        {/* Top utility bar (icons placeholders) */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 mb-4">
          <svg width="16" viewBox="0 0 17 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 18V10H11V18" stroke="#94A9C7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
            <path d="M1 6.95L8.5 1L16 6.95V16.3C16 16.7509 15.8244 17.1833 15.5118 17.5021C15.1993 17.8209 14.7754 18 14.3333 18H2.66667C2.22464 18 1.80072 17.8209 1.48816 17.5021C1.17559 17.1833 1 16.7509 1 16.3V6.95Z" stroke="#6D7F9A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
          <svg width="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.5 1C4.80558 1 1 4.80558 1 9.5C1 14.1944 4.80558 18 9.5 18C14.1944 18 18 14.1944 18 9.5C18 4.80558 14.1944 1 9.5 1Z" stroke="#6D7F9A" strokeWidth="1.5"></path>
            <path d="M10.7749 12.9L7.3749 9.50002L10.7749 6.10002" stroke="#94A9C7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </div>

        {/* Merchant + Account type row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
            <img className="h-10 w-10 rounded-full" src={logo} alt="logo" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">Oracle Pay</div>
              <div className="text-[12px] text-slate-500">Transaction ID: <span className="font-mono">{id}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <img 
              className=" w-10" 
              src={`https://api.oraclepay.org${dynamic.pageContent?.image ? dynamic.pageContent.image : logo}`} 
              alt={`${provider} logo`} 
            />
            <div className="text-right">
              <div className="text-[12px] text-slate-500">{dynamic.providerDisplay || niceProvider}</div>
              <div className="text-sm font-semibold text-slate-900">{dynamic.accountNumber}</div>
              <div className="text-[12px] text-slate-500">
  {dynamic.gateway 
    ? (dynamic.gateway.toUpperCase() === "MERCHANT" ? "AGENT" : dynamic.gateway.toUpperCase())
    : "PERSONAL"
  }
</div>
            </div>
          </div>
        </div>

        {/* Dynamic Instruction Panel */}
        <div className="rounded-2xl p-4 md:p-6" style={{ backgroundColor: dynamic.pageContent?.bgColor || '#b40000', color: dynamic.pageContent?.color || '#ffffff' }}>
          <h2 className="text-center text-xl font-semibold mb-3">{dynamic.pageContent?.note || 'ট্রান্সজেকশন আইডি দিন'}</h2>
          <div className="flex items-center justify-center">
            <input
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              placeholder="ট্রান্সজেকশন আইডি দিন"
              disabled={verifying.running || dynamic.loading || expiry.expired}
              className={`w-full mb-4 rounded-xl bg-white/95 placeholder-gray px-4 py-3 outline-none text-center text-black ${(verifying.running || dynamic.loading || expiry.expired) ? 'opacity-70 cursor-not-allowed' : 'focus:ring-2 focus:ring-black/60'}`}
            />
          </div>

          {dynamic.pageContent?.importantNote && (
            <div className="mb-4 rounded-xl bg-white/15 backdrop-blur-sm px-4 py-3 text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
              {dynamic.pageContent.importantNote}
            </div>
          )}

          {dynamic.loading && (
            <div className="animate-pulse text-center text-sm mb-4">লোড হচ্ছে...</div>
          )}

          <ul className="space-y-3 text-[15px] leading-relaxed">
            <li className="border-t border-white/20 pt-3">টাকার পরিমাণ <span className="font-bold">: ৳ {amount}</span></li>

            {(dynamic.pageContent?.details && dynamic.pageContent.details.length) ? (
              dynamic.pageContent.details.map((line, idx) => (
                <li key={idx} className="border-t border-white/20 pt-3 first:border-0 first:pt-0">
                  {line.includes(account) ? (
                    <span>
                      {line.replace(account, '')}
                      <span className="inline-flex items-center gap-2 rounded-lg bg-amber-300 text-slate-900 px-2 py-1 font-semibold ml-1">
                        {account}
                        <button type="button" onClick={handleCopy} className="ml-2 rounded-md bg-slate-900/90 text-white text-xs px-2 py-1 hover:bg-slate-900">
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </span>
                    </span>
                  ) : line}
                </li>
              ))
            ) : (
              <li className="pt-3">ইনস্ট্রাকশন পাওয়া যায়নি।</li>
            )}
          </ul>
        </div>

        {/* Note section above Verify */}
        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">নোট</h3>
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            <li>পরিমাণ (৳{amount}) অবশ্যই পাঠাবেন।</li>
            {dynamic.pageContent?.note && <li>{dynamic.pageContent.note}</li>}
          </ul>
        </div>

        <button
          type="button"
          style={{
            backgroundColor: dynamic.pageContent?.buttonTextBgColor || '#0f172a',
            color: dynamic.pageContent?.buttonTextColor || '#ffffff'
          }}
          className={`mt-6 w-full rounded-xl font-medium py-3 tracking-wide transition ${verifying.running ? 'opacity-80 cursor-not-allowed' : 'hover:opacity-90'}`}
          onClick={handleVerify}
          disabled={verifying.running || expiry.expired}
        >
          {verifying.running ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              ভেরিফাই হচ্ছে…
            </span>
          ) : (dynamic.pageContent?.buttonText || 'VERIFY')}
        </button>

        {verifying.status !== 'idle' && (
          <div className={`mt-3 text-sm rounded-xl px-4 py-3 ${verifying.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : verifying.status === 'pending' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                {verifying.message}
                {verifying.status === 'pending' && <span className="ml-2 text-xs text-black/50">(চেষ্টা: {verifying.tries}/10)</span>}
              </div>
              {verifying.status === 'success' && <span className="text-lg">✅</span>}
              {verifying.status === 'pending' && <span className="text-lg animate-pulse">⏳</span>}
              {verifying.status === 'error' && <span className="text-lg">⚠️</span>}
            </div>
          </div>
        )}
      </div>

      {/* Global overlays */}
      {(dynamic.loading) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="text-center text-white">
            <svg className="animate-spin h-14 w-14 mx-auto mb-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <div className="text-2xl font-semibold">লোড হচ্ছে…</div>
          </div>
        </div>
      )}

      {(verifying.status === 'pending') && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="mb-4">
              <svg className="animate-spin h-14 w-14 mx-auto text-slate-700" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            </div>
            <div className="text-xl font-semibold mb-1">ট্রান্সজেকশন খোঁজা হচ্ছে…</div>
            <div className="text-slate-600 mb-3">অনুগ্রহ করে অপেক্ষা করুন</div>
            <div className="text-sm text-slate-700 mb-2">সময় বাকি: <span className="font-semibold">{pendingCountdown || 0}s</span></div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-700 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, ((20 - (pendingCountdown || 0)) / 20) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {(verifying.status === 'success') && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
            {/* Success animation */}
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center animate-[pulse_1.5s_ease-in-out_infinite]">
              <svg className="h-10 w-10 text-emerald-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-emerald-700 mb-2">পেমেন্ট ভেরিফাইড</div>
            {redirectInfo.url ? (
              <div className="text-slate-700">
                <div className="mb-3">আপনাকে রিডাইরেক্ট করা হচ্ছে… <span className="font-semibold">{redirectInfo.secondsLeft}s</span></div>
                <button
                  onClick={() => { try { window.location.assign(redirectInfo.url) } catch (_) {} }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  এখনই যান
                </button>
                <div className="mt-2 text-xs text-slate-500 break-all">যদি না হয়, এখানে ক্লিক করুন: <a className="underline" onClick={(e)=>{e.preventDefault(); try { window.location.assign(redirectInfo.url) } catch (_) {} }} href={redirectInfo.url}>{redirectInfo.url}</a></div>
              </div>
            ) : (
              <div className="text-slate-700">ধন্যবাদ! আপনার পেমেন্ট নিশ্চিত হয়েছে।</div>
            )}
          </div>
        </div>
      )}

      {/* Expired session blocking overlay */}
      {expiry.expired && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center animate-[pulse_1.5s_ease-in-out_infinite]">
              <svg className="h-10 w-10 text-rose-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-rose-700 mb-2">সেশন শেষ</div>
            <div className="text-slate-700 mb-4">এই লিংকের সময়সীমা শেষ হয়ে গেছে। অনুগ্রহ করে নতুন লিংক সংগ্রহ করুন।</div>
            <button
              onClick={() => { try { window.location.href = '/' } catch (_) {} }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
            >
              হোমে যান
            </button>
          </div>
        </div>
      )}
    </div>
  )
}