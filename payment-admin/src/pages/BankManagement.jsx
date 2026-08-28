import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Landmark, Plus, Trash2, Loader2, Building } from 'lucide-react';

export default function BankManagement() {
  const { token } = useAuthStore();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    logo: '',
    status: 'active',
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return toast.error('Bank name is required');
    }
    setAdding(true);
    try {
      const res = await api.createBank(token, formData);
      if (res.success) {
        toast.success('Bank added successfully');
        setFormData({ name: '', code: '', logo: '', status: 'active' });
        fetchBanks();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create bank');
    } finally {
      setAdding(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Landmark className="w-7 h-7 text-indigo-600" />
            Bank Management
          </h1>
          <p className="text-sm text-slate-500 font-medium">Add and manage supported Banks for Agent Bank Transfers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-500" />
            Add New Bank
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Bank Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. City Bank, Islami Bank"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Bank Code (Optional)</label>
              <input
                type="text"
                placeholder="e.g. CBL, IBBL"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Logo URL (Optional)</label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={formData.logo}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Bank'}
            </button>
          </form>
        </div>

        {/* Bank List */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Supported Banks List</span>
            <span className="text-xs font-bold text-slate-400">Total: {banks.length}</span>
          </h3>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : banks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Building className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No banks created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {banks.map((bank) => (
                <div key={bank._id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {bank.logo ? (
                      <img src={bank.logo} alt={bank.name} className="w-10 h-10 object-contain rounded-lg bg-white p-1 shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">
                        {bank.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{bank.name}</h4>
                      <p className="text-xs text-slate-400 font-semibold">{bank.code || 'No Code'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${bank.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {bank.status}
                    </span>
                    <button onClick={() => handleDelete(bank._id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
