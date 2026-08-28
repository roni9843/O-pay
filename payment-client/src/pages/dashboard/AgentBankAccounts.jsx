import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

export default function AgentBankAccounts() {
  const { token } = useAuthStore();
  const [supportedBanks, setSupportedBanks] = useState([]);
  const [myAccounts, setMyAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Locations state for bdapis.com
  const [divisions, setDivisions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [upazilas, setUpazilas] = useState([]);

  const [formData, setFormData] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    branchName: '',
    division: '',
    district: '',
    upazilaThana: '',
    routingNumber: '',
    status: 'active',
  });

  // Fetch Supported Banks
  const loadData = async () => {
    try {
      setLoading(true);
      const [banksRes, myAccsRes] = await Promise.all([
        api.getSupportedBanks().catch(() => ({ success: false })),
        api.getAgentBankAccounts(token)
      ]);

      if (banksRes && banksRes.success) setSupportedBanks(banksRes.data || []);
      if (myAccsRes && myAccsRes.success) setMyAccounts(myAccsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Divisions from bdapis.com (v1.2)
  useEffect(() => {
    fetch('https://bdapis.com/api/v1.2/divisions')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setDivisions(data.data);
        }
      })
      .catch(err => console.error('Failed to load divisions:', err));
  }, []);

  // Fetch Districts when division changes
  const handleDivisionChange = (e) => {
    const selectedDiv = e.target.value;
    setFormData(prev => ({ ...prev, division: selectedDiv, district: '', upazilaThana: '' }));
    setDistricts([]);
    setUpazilas([]);

    if (!selectedDiv) return;

    fetch(`https://bdapis.com/api/v1.2/division/${selectedDiv}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setDistricts(data.data);
        }
      })
      .catch(err => console.error('Failed to load districts:', err));
  };

  // Fetch Upazilas when district changes
  const handleDistrictChange = (e) => {
    const selectedDist = e.target.value;
    setFormData(prev => ({ ...prev, district: selectedDist, upazilaThana: '' }));
    setUpazilas([]);

    if (!selectedDist) return;

    fetch(`https://bdapis.com/api/v1.2/district/${selectedDist}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data && data.data[0] && data.data[0].upazilas) {
          setUpazilas(data.data[0].upazilas);
        }
      })
      .catch(err => console.error('Failed to load upazilas:', err));
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bankName || !formData.accountHolderName || !formData.accountNumber || !formData.branchName || !formData.division || !formData.district || !formData.upazilaThana || !formData.routingNumber) {
      return alert('Please fill in all bank details');
    }

    setAdding(true);
    try {
      const res = await api.addAgentBankAccount(token, formData);
      if (res.success) {
        alert('Bank Account Added Successfully!');
        setFormData({
          bankName: '',
          accountHolderName: '',
          accountNumber: '',
          branchName: '',
          division: '',
          district: '',
          upazilaThana: '',
          routingNumber: '',
          status: 'active',
        });
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to add bank account');
    } finally {
      setAdding(false);
    }
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="p-6 rounded-2xl bg-gray-800 border border-gray-700 space-y-4 lg:col-span-1">
          <h3 className="text-base font-bold text-emerald-400">Add New Bank Account</h3>
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

            {/* BD Locations (bdapis.com Dropdowns) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1 opacity-70">Division *</label>
                <select
                  required
                  value={formData.division}
                  onChange={handleDivisionChange}
                  className="w-full p-2 rounded-lg bg-gray-900 border border-gray-700 text-xs focus:outline-none"
                >
                  <option value="">Select</option>
                  {divisions.map((d) => (
                    <option key={d.division} value={d.division}>{d.division}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1 opacity-70">District *</label>
                <select
                  required
                  disabled={!districts.length}
                  value={formData.district}
                  onChange={handleDistrictChange}
                  className="w-full p-2 rounded-lg bg-gray-900 border border-gray-700 text-xs focus:outline-none"
                >
                  <option value="">Select</option>
                  {districts.map((d) => (
                    <option key={d.district} value={d.district}>{d.district}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1 opacity-70">Thana/Upazila *</label>
                <select
                  required
                  disabled={!upazilas.length}
                  value={formData.upazilaThana}
                  onChange={(e) => setFormData({ ...formData, upazilaThana: e.target.value })}
                  className="w-full p-2 rounded-lg bg-gray-900 border border-gray-700 text-xs focus:outline-none"
                >
                  <option value="">Select</option>
                  {upazilas.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
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
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity"
            >
              {adding ? 'Adding...' : 'Save Bank Account'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="p-6 rounded-2xl bg-gray-800 border border-gray-700 lg:col-span-2">
          <h3 className="text-base font-bold text-white mb-4">My Saved Bank Accounts ({myAccounts.length})</h3>

          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading bank accounts...</div>
          ) : myAccounts.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No bank accounts added yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myAccounts.map((acc) => (
                <div key={acc._id} className="p-4 rounded-xl bg-gray-900 border border-gray-700 space-y-2 relative">
                  <button
                    onClick={() => handleDelete(acc._id)}
                    className="absolute top-3 right-3 text-red-400 hover:text-red-300 text-xs font-bold"
                  >
                    Delete
                  </button>
                  <h4 className="font-bold text-emerald-400 text-base">{acc.bankName}</h4>
                  <div className="text-xs space-y-1 opacity-80 font-mono">
                    <p><span className="text-gray-400">Holder:</span> {acc.accountHolderName}</p>
                    <p><span className="text-gray-400">Acc No:</span> {acc.accountNumber}</p>
                    <p><span className="text-gray-400">Branch:</span> {acc.branchName}</p>
                    <p><span className="text-gray-400">Location:</span> {acc.upazilaThana}, {acc.district}, {acc.division}</p>
                    <p><span className="text-gray-400">Routing:</span> {acc.routingNumber}</p>
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
