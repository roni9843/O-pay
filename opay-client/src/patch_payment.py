import re

with open('PaymentPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Import
if 'import CryptoPayModal' not in content:
    content = content.replace('import BkashPayment from "./BkashPayment";', 'import BkashPayment from "./BkashPayment";\nimport CryptoPayModal from "./CryptoPayModal";')

# 2. Add States
if 'showCryptoModal' not in content:
    content = content.replace("const [selectedMethod, setSelectedMethod] = useState('');", "const [selectedMethod, setSelectedMethod] = useState('');\n  const [showCryptoModal, setShowCryptoModal] = useState(false);\n  const [selectedCryptoName, setSelectedCryptoName] = useState(null);")

# 3. Add loadSupportedCryptos
load_crypto_str = '''
  useEffect(() => {
    async function loadSupportedCryptos() {
      try {
        const env = import.meta.env.VITE_APP_ENV || 'local';
        const query = sessionCode ? ?code=&env= : ?env=;
        const res = await fetch(${API_URL}/api/opay-business/supported-cryptos);
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setSupportedCryptos(data.data);
        }
      } catch (_) {}
    }
    loadSupportedCryptos();
  }, [sessionCode]);
'''
if 'loadSupportedCryptos' not in content:
    content = content.replace('const [supportedBanks, setSupportedBanks] = useState([]);', 'const [supportedBanks, setSupportedBanks] = useState([]);\n  const [supportedCryptos, setSupportedCryptos] = useState([]);')
    content = re.sub(r'(loadSupportedBanks\(\);\n  \}, \[.*?\]\);)', r'\1\n' + load_crypto_str, content)

# 4. Add loadSupportedBanks env params
content = re.sub(r'const res = await fetch\(\$\{API_URL\}/api/opay-business/supported-banks\);', 'const env = import.meta.env.VITE_APP_ENV || "local";\n        const query = sessionCode ? ?code=&env= : ?env=;\n        const res = await fetch(${API_URL}/api/opay-business/supported-banks);', content)
content = content.replace('loadSupportedBanks();\n  }, []);', 'loadSupportedBanks();\n  }, [sessionCode]);')

# 5. Remove bank fallback
content = content.replace('(supportedBanks.length > 0 ? supportedBanks : bankWallets).slice(0, visibleBankCount).map((wallet)', 'supportedBanks.slice(0, visibleBankCount).map((wallet)')
content = content.replace('{(supportedBanks.length > 0 ? supportedBanks : bankWallets).length > visibleBankCount && (', '{supportedBanks.length > visibleBankCount && (')

# 6. Change crypto rendering
crypto_replacement = '''{supportedCryptos.map((wallet) => {
                  return (
                    <button
                      key={wallet.name}
                      onClick={() => { setSelectedCryptoName(wallet.name); setShowCryptoModal(true); }}
                      className="flex flex-col items-center gap-2 group relative"
                    >
                      <div
                        className="
                          relative w-20 h-20 sm:w-24 sm:h-24
                          rounded-2xl bg-white shadow-md flex items-center justify-center p-4
                          transition-all duration-300
                          group-hover:shadow-xl group-hover:-translate-y-2
                        "
                      >
                        {wallet.logo ? (
                           <img
                             src={wallet.logo.startsWith('http') ? wallet.logo : ${API_URL}}
                             alt={wallet.name}
                             className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
                           />
                        ) : (
                           <span className="text-sm font-bold text-gray-400">Crypto</span>
                        )}
                      </div>'''
content = re.sub(r'\{cryptoWallets\.map\(\(wallet\) => \{[\s\S]*?className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"[\s\S]*?/>\s*</div>', crypto_replacement, content)

# 7. Add early return
early_return_str = '''  if (showCryptoModal && !paymentSuccess && !verifying && !verificationFailed) {
    return (
      <CryptoPayModal 
        amount={payableAmount}
        sessionCode={sessionCode}
        initialCryptoName={selectedCryptoName}
        onBack={() => setShowCryptoModal(false)}
        onSubmitSuccess={() => {
           setShowCryptoModal(false);
           setPaymentSuccess(true);
        }}
      />
    );
  }

  return ('''
# find the LAST "  return (" which is the main render block
parts = content.rsplit('  return (', 1)
if len(parts) == 2 and 'CryptoPayModal' not in parts[0]:
    content = parts[0] + early_return_str + parts[1]

# 8. Hide tabs when amountError
tabs_start = '        {/* ================= TABS ================= */}'
tabs_replacement = '''        {/* ================= TABS & CONTENT ================= */}
        {!amountError && (
          <>
            <div className="mt-12 flex text-sm font-medium border-b">'''
content = content.replace(tabs_start + '\n        <div className="mt-12 flex text-sm font-medium border-b">', tabs_replacement)

# close tabs block
tabs_end = '''            Secured & powered by olinuxs
          </p>
        </div>
      </div>
    </div>'''
tabs_end_replacement = '''            Secured & powered by olinuxs
          </p>
        </div>
        </>
        )}
      </div>
    </div>'''
content = content.replace(tabs_end, tabs_end_replacement)

with open('PaymentPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
