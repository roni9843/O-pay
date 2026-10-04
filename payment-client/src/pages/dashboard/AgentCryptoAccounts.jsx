import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

export default function AgentCryptoAccounts() {
  const { token } = useAuthStore();
  const [supportedCryptos, setSupportedCryptos] = useState([]);
  const [myAccounts, setMyAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    cryptoName: '',
    currency: '',
    accountNumber: '',
    accountHolderName: '',
    qrCodeLogo: '',
    status: 'active',
  });

  const getCryptoLogo = (cName) => {
    const crypto = supportedCryptos.find(c => c.name === cName);
    if (!crypto || !crypto.logo) return null;
    return crypto.logo.startsWith('http') ? crypto.logo : `${import.meta.env.VITE_API_URL}${crypto.logo}`;
  };

  const selectedCryptoInfo = supportedCryptos.find(c => c.name === formData.cryptoName) || {};
  const cryptoBgColor = selectedCryptoInfo.bgColor || '#1E5631';
  const cryptoTextColor = selectedCryptoInfo.textColor || '#ffffff';
  const cryptoLogoUrl = getCryptoLogo(formData.cryptoName);

  // Fetch Supported Cryptos
  const loadData = async () => {
    try {
      setLoading(true);
      const [cryptosRes, myAccsRes] = await Promise.all([
        api.getSupportedCryptos().catch(() => ({ success: false })),
        api.getAgentCryptoAccounts(token)
      ]);

      if (cryptosRes && cryptosRes.success) {
        setSupportedCryptos(cryptosRes.allCryptos || cryptosRes.data || []);
      }
      if (myAccsRes && myAccsRes.success) setMyAccounts(myAccsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cryptoName || !formData.accountNumber) {
      return alert('Please fill in Crypto Name and Address/Account Number');
    }

    setAdding(true);
    try {
      const res = editingId 
        ? await api.updateAgentCryptoAccount(token, editingId, formData)
        : await api.addAgentCryptoAccount(token, formData);
        
      if (res.success) {
        alert(`Crypto Account ${editingId ? 'Updated' : 'Added'} Successfully!`);
        setFormData({
          cryptoName: '',
          currency: '',
          accountNumber: '',
          accountHolderName: '',
          qrCodeLogo: '',
          status: 'active',
        });
        setEditingId(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || `Failed to ${editingId ? 'update' : 'add'} crypto account`);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (acc) => {
    setEditingId(acc._id);
    setFormData({
      cryptoName: acc.cryptoName,
      currency: acc.currency || '',
      accountNumber: acc.accountNumber,
      accountHolderName: acc.accountHolderName || '',
      qrCodeLogo: acc.qrCodeLogo || '',
      status: acc.status || 'active',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this crypto account?')) return;
    try {
      const res = await api.deleteAgentCryptoAccount(token, id);
      if (res.success) {
        alert('Crypto account deleted');
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete crypto account');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crypto Accounts Management</h1>
        <p className="text-sm opacity-70">Configure your crypto wallets to accept Crypto Transfers from customers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="p-6 rounded-2xl bg-gray-800 border border-gray-700 space-y-4 lg:col-span-1 h-fit">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-emerald-400">{editingId ? 'Edit Crypto Account' : 'Add New Crypto Account'}</h3>
            {editingId && (
              <button 
                type="button" 
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    cryptoName: '', currency: '', accountNumber: '',
                    accountHolderName: '', qrCodeLogo: '', status: 'active'
                  });
                }}
                className="text-xs text-gray-400 hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Select Crypto Network *</label>
              <select
                required
                value={formData.cryptoName}
                onChange={(e) => setFormData({ ...formData, cryptoName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Choose Crypto --</option>
                {supportedCryptos.map((c) => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Wallet Address / Account No *</label>
              <input
                type="text"
                required
                placeholder="e.g. 0x123..."
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Upload QR Code Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  try {
                    const res = await api.uploadPaymentPageImage(token, file);
                    if (res.success && res.url) {
                      setFormData(prev => ({ ...prev, qrCodeLogo: res.url }));
                    }
                  } catch (err) {
                    alert('Upload failed');
                  }
                }}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500 text-xs text-gray-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-500 hover:file:bg-emerald-500/20"
              />
              {formData.qrCodeLogo && (
                <div className="mt-2 p-2 bg-black rounded-lg border border-gray-700 w-fit">
                  <img src={formData.qrCodeLogo.startsWith('http') ? formData.qrCodeLogo : `${import.meta.env.VITE_API_URL || ''}${formData.qrCodeLogo}`} alt="QR Code" className="h-16 w-16 object-contain" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Account Holder Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Rahat Chowdhury"
                value={formData.accountHolderName}
                onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={adding}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity mt-4"
            >
              {adding ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Crypto Account' : 'Save Crypto Account')}
            </button>
          </form>
        </div>

        {/* Live Preview */}
        <div className="p-6 rounded-2xl bg-gray-800 border border-gray-700 lg:col-span-1 flex flex-col items-center justify-center">
          <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2 w-full">
            <span className="text-emerald-400">📱</span> Live Customer Preview
          </h3>
          
          <div className="w-full max-w-[360px] h-[650px] bg-white rounded-[40px] border-[8px] border-gray-900 shadow-2xl relative overflow-hidden flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 p-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs">O</div>
                  <span className="font-bold text-gray-800 text-sm">Opay</span>
                </div>
              </div>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 flex flex-col relative custom-scrollbar">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Amount To Pay</p>
                <h2 className="text-2xl font-black text-gray-800">
                  50.00 <span className="text-sm font-bold text-gray-500">USD</span>
                </h2>
              </div>

              {/* Crypto Details Card */}
              <div 
                className="rounded-t-2xl p-4 flex items-center gap-3 shadow-md relative overflow-hidden"
                style={{ backgroundColor: cryptoBgColor, color: cryptoTextColor }}
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner shrink-0 relative z-10 p-1">
                  {cryptoLogoUrl ? (
                    <img src={cryptoLogoUrl} alt={formData.cryptoName} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-lg font-black text-gray-800">{(formData.cryptoName || 'C').charAt(0)}</span>
                  )}
                </div>
                <div className="relative z-10 min-w-0 flex-1">
                  <h2 className="text-base font-black uppercase tracking-wide line-clamp-1 truncate">{formData.cryptoName || 'Select Crypto'}</h2>
                  {formData.currency && <p className="text-[9px] font-bold uppercase tracking-wider line-clamp-1 truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{formData.currency}</p>}
                </div>
              </div>

              <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-md p-4 space-y-3 mb-4">
                {[
                  { icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', label: 'WALLET NAME', value: formData.accountHolderName || '...' },
                  { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'ADDRESS', value: formData.accountNumber || '...' },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                      <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-800 font-mono tracking-wide break-all">{item.value}</span>
                      <span className="text-[9px] font-bold text-[#0EB78C] bg-[#0EB78C]/10 px-1.5 py-0.5 rounded ml-2">COPY</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-4 text-center">
                <span className="text-xs font-bold text-gray-700">Upload Transfer Proof</span>
              </div>
              
              <div className="mt-auto pt-4">
                <button className="w-full py-3 bg-gradient-to-r from-[#0EB78C] to-[#16007A] text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 text-sm">
                  Complete Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-6 rounded-2xl bg-gray-800 border border-gray-700">
        <h3 className="text-base font-bold text-white mb-4">My Crypto Accounts ({myAccounts.length})</h3>

          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading crypto accounts...</div>
          ) : myAccounts.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No crypto accounts added yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myAccounts.map((acc) => (
                <div key={acc._id} className="p-4 rounded-xl bg-gray-900 border border-gray-700 space-y-3 relative group">
                  <div className="absolute top-3 right-3 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(acc)}
                      className="text-cyan-400 hover:text-cyan-300 text-xs font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(acc._id)}
                      className="text-red-400 hover:text-red-300 text-xs font-bold"
                    >
                      Delete
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3 pr-16">
                    {getCryptoLogo(acc.cryptoName) ? (
                      <img src={getCryptoLogo(acc.cryptoName)} alt={acc.cryptoName} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700">
                        🔗
                      </div>
                    )}
                    <h4 className="font-bold text-emerald-400 text-base">{acc.cryptoName}</h4>
                  </div>
                  
                  <div className="text-xs space-y-1 opacity-80 font-mono break-all">
                    {acc.accountHolderName && <p><span className="text-gray-400">Holder:</span> {acc.accountHolderName}</p>}
                    <p><span className="text-gray-400">Address:</span> {acc.accountNumber}</p>
                    {acc.qrCodeLogo && <p className="text-emerald-400 font-bold">✓ QR Code Uploaded</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
