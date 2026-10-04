import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

export default function AgentBankAccounts() {
  const { token } = useAuthStore();
  const [supportedBanks, setSupportedBanks] = useState([]);
  const [myAccounts, setMyAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    branchName: '',
    district: '',
    routingNumber: '',
    status: 'active',
  });

  const getBankLogo = (bankName) => {
    const bank = supportedBanks.find(b => b.name === bankName);
    if (!bank || !bank.logo) return null;
    return bank.logo.startsWith('http') ? bank.logo : `${import.meta.env.VITE_API_URL}${bank.logo}`;
  };

  const selectedBankInfo = supportedBanks.find(b => b.name === formData.bankName) || {};
  const bankBgColor = selectedBankInfo.bgColor || '#1E5631';
  const bankTextColor = selectedBankInfo.textColor || '#ffffff';
  const bankLabelColor = selectedBankInfo.labelColor || '#bbf7d0';
  const bankLogoUrl = getBankLogo(formData.bankName);

  // Fetch Supported Banks
  const loadData = async () => {
    try {
      setLoading(true);
      const [banksRes, myAccsRes] = await Promise.all([
        api.getSupportedBanks().catch(() => ({ success: false })),
        api.getAgentBankAccounts(token)
      ]);

      if (banksRes && banksRes.success) {
        setSupportedBanks(banksRes.allBanks || banksRes.data || []);
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
    if (!formData.bankName || !formData.accountHolderName || !formData.accountNumber || !formData.branchName || !formData.district || !formData.routingNumber) {
      return alert('Please fill in all bank details');
    }

    setAdding(true);
    try {
      const res = editingId 
        ? await api.updateAgentBankAccount(token, editingId, formData)
        : await api.addAgentBankAccount(token, formData);
        
      if (res.success) {
        alert(`Bank Account ${editingId ? 'Updated' : 'Added'} Successfully!`);
        setFormData({
          bankName: '',
          accountHolderName: '',
          accountNumber: '',
          branchName: '',
          district: '',
          routingNumber: '',
          status: 'active',
        });
        setEditingId(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || `Failed to ${editingId ? 'update' : 'add'} bank account`);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (acc) => {
    setEditingId(acc._id);
    setFormData({
      bankName: acc.bankName,
      accountHolderName: acc.accountHolderName,
      accountNumber: acc.accountNumber,
      branchName: acc.branchName,
      district: acc.district,
      routingNumber: acc.routingNumber,
      status: acc.status || 'active',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bank account?')) return;
    try {
      const res = await api.deleteAgentBankAccount(token, id);
      if (res.success) {
        alert('Bank account deleted');
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete bank account');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bank Accounts Management</h1>
        <p className="text-sm opacity-70">Configure your bank accounts to accept Bank Transfers from customers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="p-6 rounded-2xl bg-gray-800 border border-gray-700 space-y-4 lg:col-span-1 h-fit">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-emerald-400">{editingId ? 'Edit Bank Account' : 'Add New Bank Account'}</h3>
            {editingId && (
              <button 
                type="button" 
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    bankName: '', accountHolderName: '', accountNumber: '',
                    branchName: '', district: '', routingNumber: '', status: 'active'
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
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Select Bank *</label>
              <select
                required
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Choose Bank --</option>
                {supportedBanks.map((b) => (
                  <option key={b._id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Account Holder Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Rahat Chowdhury"
                value={formData.accountHolderName}
                onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Account Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. 1502203948001"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Branch Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dhanmondi Branch"
                value={formData.branchName}
                onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">District *</label>
              <input
                type="text"
                required
                placeholder="e.g. DHAKA"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value.toUpperCase() })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1 opacity-70">Routing Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. 125271294"
                value={formData.routingNumber}
                onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={adding}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity mt-4"
            >
              {adding ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Bank Account' : 'Save Bank Account')}
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
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-400 font-bold uppercase">Session #88test20</span>
              </div>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 flex flex-col relative custom-scrollbar">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Amount To Pay</p>
                <h2 className="text-2xl font-black text-gray-800">
                  500.00 <span className="text-sm font-bold text-gray-500">BDT</span>
                </h2>
              </div>

              {/* Bank Details Card */}
              <div 
                className="rounded-t-2xl p-4 flex items-center gap-3 shadow-md relative overflow-hidden"
                style={{ backgroundColor: bankBgColor, color: bankTextColor }}
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner shrink-0 relative z-10 p-1">
                  {bankLogoUrl ? (
                    <img src={bankLogoUrl} alt={formData.bankName} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-lg font-black text-gray-800">{(formData.bankName || 'B').charAt(0)}</span>
                  )}
                </div>
                <div className="relative z-10 min-w-0 flex-1">
                  <h2 className="text-base font-black uppercase tracking-wide line-clamp-1 truncate">{formData.bankName || 'Select Bank'}</h2>
                  <p className="text-[9px] font-bold uppercase tracking-wider line-clamp-1 truncate" style={{ color: bankLabelColor }}>BRANCH: {formData.branchName || '...'}</p>
                </div>
              </div>

              <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-md p-4 space-y-3 mb-4">
                {[
                  { icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', label: 'A/C NAME', value: formData.accountHolderName || '...' },
                  { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'A/C NUMBER', value: formData.accountNumber || '...' },
                  { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'BRANCH', value: formData.branchName || '...' },
                  { icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', label: 'ROUTING NO', value: formData.routingNumber || '...' },
                  { icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l5.447-2.724A1 1 0 0116 5.618v10.764a1 1 0 01-1.447.894L9 20z', label: 'DISTRICT', value: formData.district || '...' }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                      <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-800 font-mono tracking-wide">{item.value}</span>
                      <span className="text-[9px] font-bold text-[#0EB78C] bg-[#0EB78C]/10 px-1.5 py-0.5 rounded">COPY</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex gap-2">
                <div className="mt-0.5">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-[10px] text-red-700 font-medium leading-relaxed">
                  <strong className="font-bold">নোট:</strong> এন পি এস বি ব্যাংক টাকা ট্রান্সফার করার ক্ষেত্রে কোন রকম সেন্ড মানি বা পেমেন্ট অপশন নির্বাচন করবেন না।
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-4 text-center">
                <span className="text-xs font-bold text-gray-700">Upload Payment Proof</span>
              </div>
              
              <div className="mt-auto pt-4">
                <button className="w-full py-3 bg-gradient-to-r from-[#0EB78C] to-[#16007A] text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 text-sm">
                  Pay ৳500.00
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-6 rounded-2xl bg-gray-800 border border-gray-700">
        <h3 className="text-base font-bold text-white mb-4">My Saved Bank Accounts ({myAccounts.length})</h3>

          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading bank accounts...</div>
          ) : myAccounts.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No bank accounts added yet.</div>
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
                    {getBankLogo(acc.bankName) ? (
                      <img src={getBankLogo(acc.bankName)} alt={acc.bankName} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700">
                        🏦
                      </div>
                    )}
                    <h4 className="font-bold text-emerald-400 text-base">{acc.bankName}</h4>
                  </div>
                  
                  <div className="text-xs space-y-1 opacity-80 font-mono">
                    <p><span className="text-gray-400">Holder:</span> {acc.accountHolderName}</p>
                    <p><span className="text-gray-400">Acc No:</span> {acc.accountNumber}</p>
                    <p><span className="text-gray-400">Branch:</span> {acc.branchName}</p>
                    <p><span className="text-gray-400">Location:</span> {acc.district}</p>
                    <p><span className="text-gray-400">Routing:</span> {acc.routingNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
