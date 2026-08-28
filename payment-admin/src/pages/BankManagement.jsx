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
  });

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

  useEffect(() => {
    if (token) fetchBanks();
  }, [token]);

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
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', logo: '', status: 'active', sortOrder: 0, bgColor: '#ffffff', textColor: '#1e293b' });
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
          setFormData({ name: '', code: '', logo: '', status: 'active', sortOrder: 0, bgColor: '#ffffff', textColor: '#1e293b' });
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
              {editingId ? 'Edit Bank' : 'Add New Bank'}
            </h3>
            {editingId && (
              <button onClick={handleCancelEdit} className="text-xs font-bold text-slate-400 hover:text-slate-700">
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Bank Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. City Bank, Islami Bank"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Bank Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. CBL, IBBL"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
              />
            </div>

            {/* Logo File Upload Section */}
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Bank Logo / Image Upload
              </label>
              <div className="flex items-center gap-3">
                {formData.logo ? (
                  <div className="relative w-12 h-12 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm flex items-center justify-center flex-shrink-0">
                    <img src={formData.logo} alt="Logo" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logo: '' })}
                      className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center shadow"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <Building className="w-6 h-6" />
                  </div>
                )}

                <label className="flex-1 cursor-pointer">
                  <div className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-bold border border-indigo-200/60 transition-colors flex items-center justify-center gap-2 text-center">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{uploading ? 'Uploading...' : 'Choose Logo File'}</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Color Controls (Background & Text Color) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Card Background Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.bgColor}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.bgColor}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Text / Title Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.textColor}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.textColor}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Sorting Order & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Update Bank' : 'Save Bank'}
            </button>
          </form>
        </div>

        {/* Bank List & Usage Cards */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Supported Banks</h3>
              <p className="text-xs text-slate-400 font-semibold">Sorted by order & name</p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black text-xs rounded-full border border-indigo-100">
              Total: {banks.length}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : banks.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Building className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm font-bold text-slate-500">No banks created yet.</p>
              <p className="text-xs text-slate-400">Use the form on the left to add your first bank.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {banks.map((bank) => (
                <div
                  key={bank._id}
                  style={{ backgroundColor: bank.bgColor || '#f8fafc' }}
                  className="p-4 rounded-2xl border border-slate-200/80 hover:shadow-lg transition-all space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {bank.logo ? (
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/60 p-2 shadow-md flex items-center justify-center flex-shrink-0">
                          <img src={bank.logo} alt={bank.name} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-base shadow-sm flex-shrink-0">
                          {bank.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 style={{ color: bank.textColor || '#0f172a' }} className="font-black text-sm leading-snug">
                          {bank.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black uppercase opacity-60 tracking-wider" style={{ color: bank.textColor || '#64748b' }}>
                            {bank.code || 'NO CODE'}
                          </span>
                          <span className="text-[10px] opacity-40">•</span>
                          <span className="text-[10px] font-bold opacity-60 flex items-center gap-0.5" style={{ color: bank.textColor || '#64748b' }}>
                            <ArrowUpDown className="w-3 h-3" /> Order: {bank.sortOrder || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(bank)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors"
                        title="Edit Bank"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bank._id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
                        title="Delete Bank"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Usage Info Footer */}
                  <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{bank.agentAccountCount || 0} Agent Accounts</span>
                    </div>

                    <span
                      className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        bank.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {bank.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
