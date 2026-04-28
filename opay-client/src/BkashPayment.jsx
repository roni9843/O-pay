import React from "react";
import logo from "./assets/appstore.png";

export default function MobileBankingPage({
  onBack,
  onVerify,
  amount: amountProp,
  walletName = "bKash",
  initialTxid,
  accountNumber,
  gateway,
  merchantName,
  template,
  masked = false
}) {
  const [txid, setTxid] = React.useState(initialTxid || "");
  const [copied, setCopied] = React.useState(false);

  let account = accountNumber || "01700123456";
  if (masked && account && account.length >= 4) {
    account = `*****${account.slice(-3)}`;
  }
  
  const amount = amountProp || "10.00";

   const panelBg = template?.bgColor || "#b40000";
   const panelColor = template?.color || "#ffffff";
   const details = Array.isArray(template?.details) ? template.details : [];
   const noteText = template?.note || "";
   const importantNoteText = template?.importantNote || "";
   const btnLabel = template?.buttonText || "VERIFY";
   const btnBg = template?.buttonTextBgColor || "#0f172a";
   const btnColor = template?.buttonTextColor || "#ffffff";

  React.useEffect(() => {
    if (initialTxid) {
      setTxid(initialTxid);
    }
  }, [initialTxid]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_) {}
  };

  return (
    <div className="min-h-screen w-full bg-sky-50 p-3 flex items-center justify-center">
      <div className="w-full max-w-2xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-md p-4 md:p-6">
        {/* Top utility bar */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            <svg width="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Back</span>
          </button>
          <svg width="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.5 1C4.80558 1 1 4.80558 1 9.5C1 14.1944 4.80558 18 9.5 18C14.1944 18 18 14.1944 18 9.5C18 4.80558 14.1944 1 9.5 1Z" stroke="#6D7F9A" strokeWidth="1.5"></path>
            <path d="M10.7749 12.9L7.3749 9.50002L10.7749 6.10002" stroke="#94A9C7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </div>

        {/* Merchant + Account row (previous design) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-[linear-gradient(135deg,#20CFA2,#211060)] p-4 flex items-center gap-3">
            <img className="h-10 w-10 rounded-full" src={logo} alt="logo" />
            <div className="leading-tight text-white">
              <div className="text-sm font-semibold">{merchantName || "Oracle Pay"}</div>
              <div className="text-[12px]">
                Transaction ID: <span className="font-mono">BKASH-DEMO-12345</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs">
                bK
              </div>
              <div className="text-[12px] text-slate-500">{walletName} Payment Method</div>
            </div>
            <div className="text-right">
              <div className="text-[12px] text-slate-500">Account</div>
              <div className="text-sm font-semibold text-slate-900">{account}</div>
              <div className="text-[12px] text-slate-500">{gateway === 'merchant' ? 'AGENT' : 'PERSONAL'}</div>
            </div>
          </div>
        </div>

        {/* Instruction Panel (driven by template) */}
        <div className="rounded-2xl p-4 md:p-6" style={{ backgroundColor: panelBg, color: panelColor }}>
          <h2 className="text-center text-xl font-semibold mb-3">ট্রান্সজেকশন আইডি দিন</h2>

          <div className="flex items-center justify-center">
            <input
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              placeholder="ট্রান্সজেকশন আইডি দিন"
              className="w-full mb-4 rounded-xl bg-white/95 placeholder-gray px-4 py-3 outline-none text-center text-black focus:ring-2 focus:ring-black/60"
            />
          </div>

          <ul className="space-y-3 text-[15px] leading-relaxed">
            {/* Always show dynamic amount + account lines */}
            <li className="border-t border-white/20 pt-3">
              টাকার পরিমাণ <span className="font-bold">: ৳ {amount}</span>
            </li>
            <li className="border-t border-white/20 pt-3 flex items-center justify-between gap-2">
              <span>
                প্রাপক নম্বর হিসেবে দিনঃ <span className="font-bold">{account}</span>
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="ml-2 rounded-md bg-amber-300 text-slate-900 text-xs px-3 py-1 font-semibold hover:bg-amber-400"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </li>
            {/* Extra instructional lines from template (admin configurable) */}
            {details.map((line, idx) => (
              <li key={idx} className="border-t border-white/20 pt-3">
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Note section and Verify button */}
        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">নোট</h3>
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            {noteText && <li>{noteText}</li>}
            {importantNoteText && <li>{importantNoteText}</li>}
          </ul>
        </div>

        <button
          type="button"
          style={{ backgroundColor: btnBg, color: btnColor }}
          className="mt-6 w-full rounded-xl font-medium py-3 tracking-wide transition hover:opacity-90"
          onClick={() => onVerify(txid)}
        >
          {btnLabel || "VERIFY"}
        </button>
      </div>
    </div>
  );
}
