import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Landmark, Plus, Trash2, Loader2, Building, Edit, Upload, ArrowUpDown, ShieldCheck, Users } from 'lucide-react';

export default function BankManagement() {
  const { token } = useAuthStore();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    logo: '',
    status: 'active',
    sortOrder: 0,
    bgColor: '#ffffff',
    textColor: '#1e293b',
    labelColor: '#94a3b8',
  });

  const [activeTab, setActiveTab] = useState('banks'); // 'banks' | 'agentAccounts'
  const [agentAccounts, setAgentAccounts] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');

  const [editingAgentAccount, setEditingAgentAccount] = useState(null);
  const [agentForm, setAgentForm] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    branchName: '',
    division: '',
    district: '',
    upazilaThana: '',
    routingNumber: '',
    status: 'active'
  });

  const handleEditAgentAccountClick = (acc) => {
    setEditingAgentAccount(acc);
    setAgentForm({
      bankName: acc.bankName || '',
      accountHolderName: acc.accountHolderName || '',
      accountNumber: acc.accountNumber || '',
      branchName: acc.branchName || '',
      division: acc.division || '',
      district: acc.district || '',
      upazilaThana: acc.upazilaThana || '',
      routingNumber: acc.routingNumber || '',
      status: acc.status || 'active'
    });
  };

  const handleSaveAgentAccount = async (e) => {
    e.preventDefault();
    if (!editingAgentAccount) return;
    try {
      const res = await api.updateAgentBankAccount(token, editingAgentAccount._id, agentForm);
      if (res.success) {
        toast.success('Agent bank account updated!');
        setEditingAgentAccount(null);
        fetchAgentAccounts();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update agent account');
    }
  };

  const fetchBanks = async () => {
    try {
      setLoading(true);
      const res = await api.getBankList(token);
      if (res.success) {
        setBanks(res.data || []);
      }
    } catch (err) {
      toast.error('Failed to load bank list');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentAccounts = async () => {
    try {
      setAgentLoading(true);
      const res = await api.getAgentBankAccounts(token);
      if (res.success) {
        setAgentAccounts(res.data || []);
      }
    } catch (err) {
      toast.error('Failed to load agent bank accounts');
    } finally {
      setAgentLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchBanks();
      fetchAgentAccounts();
    }
  }, [token]);

  const handleDeleteAgentAccount = async (id) => {
    if (!window.confirm('Are you sure you want to DELETE this Agent bank account?')) return;
    try {
      const res = await api.deleteAgentBankAccount(token, id);
      if (res.success) {
        toast.success('Agent bank account deleted');
        fetchAgentAccounts();
        fetchBanks();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete agent account');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await api.uploadPaymentPageImage(token, file);
      if (data && data.url) {
        setFormData((prev) => ({ ...prev, logo: data.url }));
        toast.success('Logo uploaded successfully');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (err) {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (bank) => {
    setEditingId(bank._id);
    setFormData({
      name: bank.name,
      code: bank.code || '',
      logo: bank.logo || '',
      status: bank.status || 'active',
      sortOrder: bank.sortOrder || 0,
      bgColor: bank.bgColor || '#ffffff',
      textColor: bank.textColor || '#1e293b',
      labelColor: bank.labelColor || '#94a3b8',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', logo: '', status: 'active', sortOrder: 0, bgColor: '#ffffff', textColor: '#1e293b', labelColor: '#94a3b8' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return toast.error('Bank name is required');
    }

    setSaving(true);
    try {
      if (editingId) {
        const res = await api.updateBank(token, editingId, formData);
        if (res.success) {
          toast.success('Bank updated successfully!');
          handleCancelEdit();
          fetchBanks();
        }
      } else {
        const res = await api.createBank(token, formData);
        if (res.success) {
          toast.success('Bank added successfully');
          setFormData({ name: '', code: '', logo: '', status: 'active', sortOrder: 0, bgColor: '#ffffff', textColor: '#1e293b', labelColor: '#94a3b8' });
          fetchBanks();
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save bank');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bank?')) return;
    try {
      const res = await api.deleteBank(token, id);
      if (res.success) {
        toast.success('Bank deleted');
        fetchBanks();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete bank');
    }
  };

  const formatImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400">System Gateway</span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 mt-1">
            <Landmark className="w-8 h-8 text-indigo-400" />
            Bank Management
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Configure supported banks, upload logos, set background/text colors, display sorting order, and view Agent usage counts.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-xs font-bold w-fit">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Active Banks: {banks.filter(b => b.status === 'active').length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-2xl lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
              {editingId ? 'Edit Bank' : 'Add New Bank'}
            </h3>
            {editingId && (
              <button onClick={handleCancelEdit} className="text-xs font-bold text-slate-400 hover:text-white">
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Bank Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. City Bank, Islami Bank"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-black/40 border border-white/10 rounded-2xl focus:bg-black/60 focus:border-indigo-500/50 focus:outline-none font-semibold text-white placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Bank Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. CBL, IBBL"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-black/40 border border-white/10 rounded-2xl focus:bg-black/60 focus:border-indigo-500/50 focus:outline-none font-semibold text-white placeholder-slate-500"
              />
            </div>

            {/* Logo File Upload Section */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Bank Logo / Image Upload
              </label>
              <div className="flex items-center gap-3">
                {formData.logo ? (
                  <div className="relative w-12 h-12 rounded-2xl border border-white/10 bg-black p-1.5 shadow-sm flex items-center justify-center flex-shrink-0">
                    <img src={formatImgUrl(formData.logo)} alt="Logo" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logo: '' })}
                      className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center shadow"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-black/40 border border-dashed border-white/20 flex items-center justify-center text-slate-500 flex-shrink-0">
                    <Building className="w-6 h-6" />
                  </div>
                )}

                <label className="flex-1 cursor-pointer">
                  <div className="px-3.5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-2xl text-xs font-bold border border-indigo-500/30 transition-colors flex items-center justify-center gap-2 text-center">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{uploading ? 'Uploading...' : 'Choose Logo File'}</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Color Controls (Background, Text & Label Color) */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Card Bg
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={formData.bgColor}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    className="w-7 h-7 rounded-lg border border-white/10 cursor-pointer p-0.5 bg-black"
                  />
                  <input
                    type="text"
                    value={formData.bgColor}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    className="w-full px-1.5 py-1 text-[11px] font-mono bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Value Color
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={formData.textColor}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-7 h-7 rounded-lg border border-white/10 cursor-pointer p-0.5 bg-black"
                  />
                  <input
                    type="text"
                    value={formData.textColor}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-full px-1.5 py-1 text-[11px] font-mono bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Title Label
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={formData.labelColor}
                    onChange={(e) => setFormData({ ...formData, labelColor: e.target.value })}
                    className="w-7 h-7 rounded-lg border border-white/10 cursor-pointer p-0.5 bg-black"
                  />
                  <input
                    type="text"
                    value={formData.labelColor}
                    onChange={(e) => setFormData({ ...formData, labelColor: e.target.value })}
                    className="w-full px-1.5 py-1 text-[11px] font-mono bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Sorting Order & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm bg-black/40 border border-white/10 rounded-2xl focus:bg-black/60 focus:outline-none font-semibold text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-black/40 border border-white/10 rounded-2xl focus:bg-black/60 focus:outline-none font-semibold text-white"
                >
                  <option value="active" className="bg-slate-900 text-white">Active</option>
                  <option value="inactive" className="bg-slate-900 text-white">Inactive</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Update Bank' : 'Save Bank'}
            </button>
          </form>
        </div>

        {/* Bank List & Agent Accounts Cards */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-2xl lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={() => setActiveTab('banks')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'banks'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Supported Banks ({banks.length})
              </button>
              <button
                onClick={() => setActiveTab('agentAccounts')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === 'agentAccounts'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Agent Accounts List ({agentAccounts.length})
              </button>
            </div>

            {activeTab === 'agentAccounts' && (
              <input
                type="text"
                placeholder="Search agent, bank, account..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="px-3.5 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl focus:bg-black/60 focus:outline-none font-semibold text-white placeholder-slate-500"
              />
            )}
          </div>

          {activeTab === 'banks' ? (
            loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              </div>
            ) : banks.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Building className="w-12 h-12 mx-auto opacity-30 text-indigo-400" />
                <p className="text-sm font-bold text-slate-300">No banks created yet.</p>
                <p className="text-xs text-slate-500">Use the form on the left to add your first bank.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {banks.map((bank) => (
                  <div
                    key={bank._id}
                    style={{ backgroundColor: bank.bgColor || '#0f172a' }}
                    className="p-4 rounded-2xl border border-white/10 hover:shadow-xl transition-all space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {bank.logo ? (
                          <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 p-2 shadow-md flex items-center justify-center flex-shrink-0">
                            <img src={formatImgUrl(bank.logo)} alt={bank.name} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-base shadow-sm flex-shrink-0">
                            {bank.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 style={{ color: bank.textColor || '#ffffff' }} className="font-black text-sm leading-snug">
                            {bank.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black uppercase opacity-70 tracking-wider" style={{ color: bank.textColor || '#cbd5e1' }}>
                              {bank.code || 'NO CODE'}
                            </span>
                            <span className="text-[10px] opacity-40">•</span>
                            <span className="text-[10px] font-bold opacity-70 flex items-center gap-0.5" style={{ color: bank.textColor || '#cbd5e1' }}>
                              <ArrowUpDown className="w-3 h-3" /> Order: {bank.sortOrder || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(bank)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-xl hover:bg-white/10 transition-colors"
                          title="Edit Bank"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(bank._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-white/10 transition-colors"
                          title="Delete Bank"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Usage Info Footer */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{bank.agentAccountCount || 0} Agent Accounts</span>
                      </div>

                      <span
                        className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          bank.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600/40'
                        }`}
                      >
                        {bank.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Agent Accounts Table List (CRUD) */
            agentLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              </div>
            ) : agentAccounts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Users className="w-12 h-12 mx-auto opacity-30 text-indigo-400" />
                <p className="text-sm font-bold text-slate-300">No agent bank accounts submitted yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-black/40 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-white/10">
                      <th className="p-3">Wallet Agent</th>
                      <th className="p-3">Bank Name & Acc No</th>
                      <th className="p-3">Holder Name</th>
                      <th className="p-3">Branch & Routing</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                    {agentAccounts
                      .filter((acc) => {
                        const q = agentSearch.toLowerCase();
                        return (
                          !q ||
                          acc.bankName?.toLowerCase().includes(q) ||
                          acc.accountNumber?.toLowerCase().includes(q) ||
                          acc.accountHolderName?.toLowerCase().includes(q) ||
                          acc.owner?.name?.toLowerCase().includes(q) ||
                          acc.owner?.email?.toLowerCase().includes(q)
                        );
                      })
                      .map((acc) => (
                        <tr key={acc._id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-white">{acc.owner?.name || 'Wallet Agent'}</div>
                            <div className="text-[10px] text-amber-300 font-mono">{acc.owner?.email || 'N/A'}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-indigo-300">{acc.bankName}</div>
                            <div className="font-mono text-slate-300 text-[11px] font-bold">Acc: {acc.accountNumber}</div>
                          </td>
                          <td className="p-3 font-semibold text-slate-200">
                            {acc.accountHolderName}
                          </td>
                          <td className="p-3">
                            <div className="text-slate-300">{acc.branchName || 'N/A'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Rt: {acc.routingNumber || 'N/A'}</div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditAgentAccountClick(acc)}
                                className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-xl transition-colors font-bold text-xs inline-flex items-center gap-1"
                                title="Edit Agent Account"
                              >
                                <Edit className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAgentAccount(acc._id)}
                                className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl transition-colors font-bold text-xs inline-flex items-center gap-1"
                                title="Delete Agent Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Edit Agent Bank Account Modal */}
      {editingAgentAccount && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setEditingAgentAccount(null)}>
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 relative border border-white/10 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-white text-lg flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" /> Edit Agent Bank Account
              </h3>
              <button onClick={() => setEditingAgentAccount(null)} className="text-slate-400 hover:text-white font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleSaveAgentAccount} className="space-y-3.5 text-xs font-semibold">
              <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block">Agent Owner:</span>
                <span className="text-white font-bold text-sm">{editingAgentAccount.owner?.name}</span>
                <span className="text-amber-300 text-xs block font-mono font-bold">{editingAgentAccount.owner?.email}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    value={agentForm.bankName}
                    onChange={(e) => setAgentForm({ ...agentForm, bankName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:bg-black/60 focus:outline-none text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Account Number</label>
                  <input
                    type="text"
                    required
                    value={agentForm.accountNumber}
                    onChange={(e) => setAgentForm({ ...agentForm, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:bg-black/60 focus:outline-none font-mono font-bold text-indigo-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Account Holder Name</label>
                <input
                  type="text"
                  required
                  value={agentForm.accountHolderName}
                  onChange={(e) => setAgentForm({ ...agentForm, accountHolderName: e.target.value })}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:bg-black/60 focus:outline-none font-bold text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={agentForm.branchName}
                    onChange={(e) => setAgentForm({ ...agentForm, branchName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:bg-black/60 focus:outline-none text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Routing Number</label>
                  <input
                    type="text"
                    value={agentForm.routingNumber}
                    onChange={(e) => setAgentForm({ ...agentForm, routingNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:bg-black/60 focus:outline-none font-mono text-slate-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingAgentAccount(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
