import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, X, Eye, UploadCloud, Check, Settings, Trash } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function TopupMethods() {
  const token = useAuthStore(s => s.token);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [details, setDetails] = useState('');
  const [fields, setFields] = useState([{ label: 'Transaction ID', inputType: 'text', required: true }]);
  
  const [uploading, setUploading] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE}${path}`;
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const res = await api.getCreditTopupMethods();
      setMethods(res.data || []);
    } catch (err) {
      console.error(err);
      // alert('Failed to load methods');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadPaymentPageImage(token, file);
      if (res && res.url) {
        setImage(res.url);
      }
    } catch (err) {
      alert('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name, image, details, fields };
    try {
      if (editingId) {
        alert("Edit not implemented yet, please delete and recreate for now.");
      } else {
        await api.createCreditTopupMethod(token, payload);
      }
      setShowModal(false);
      resetForm();
      fetchMethods();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await api.deleteCreditTopupMethod(token, id);
      fetchMethods();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const resetForm = () => {
    setName('');
    setImage('');
    setDetails('');
    setFields([{ label: 'Transaction ID', inputType: 'text', required: true }]);
    setEditingId(null);
  };

  const addField = () => {
    setFields([...fields, { label: '', inputType: 'text', required: true }]);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index, key, value) => {
    const newFields = [...fields];
    newFields[index][key] = value;
    setFields(newFields);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-r from-violet-600/20 via-blue-600/10 to-transparent p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
             <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
               Payment Methods
             </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
             Configure payment gateways and manual payment methods for credit top-ups.
          </p>
        </div>

        <div className="relative z-10">
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-900/40 hover:scale-105 transition-transform"
          >
            <Plus size={18} /> Add Method
          </button>
        </div>
      </div>

      {/* Grid of Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {methods.map((m) => (
           <div key={m._id} className="group rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl p-5 hover:bg-white/10 hover:border-white/10 transition-all flex flex-col justify-between">
              <div>
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-2xl bg-white/5 p-2 border border-white/10 flex items-center justify-center">
                          {m.image ? (
                             <img src={getImageUrl(m.image)} alt={m.name} className="w-full h-full object-contain" />
                          ) : (
                             <span className="font-bold text-lg text-slate-400">{m.name[0]}</span>
                          )}
                       </div>
                       <div>
                          <h3 className="font-bold text-white">{m.name}</h3>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {m._id.slice(-4)}</div>
                       </div>
                    </div>
                    <button 
                       onClick={() => handleDelete(m._id)}
                       className="p-2 rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                       <Trash2 size={18} />
                    </button>
                 </div>

                 <div className="bg-black/20 rounded-xl p-3 mb-4">
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                       {m.details || "No instructions provided."}
                    </p>
                 </div>

                 <div className="space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                       <Settings className="w-3 h-3" /> Required Fields
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                       {m.fields.map((f, i) => (
                         <span key={i} className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-medium text-indigo-300">
                            {f.label}
                         </span>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        ))}
      </div>

      {methods.length === 0 && !loading && (
         <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <p className="text-slate-500">No payment methods configured yet.</p>
         </div>
      )}

      {/* Modal - Cosmic Design */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
           <div className="bg-[#050510] border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
             
             {/* Header */}
             <div className="p-6 border-b border-white/5 bg-[#050510]/80 backdrop-blur-xl flex justify-between items-center sticky top-0 z-10">
                <div>
                   <h2 className="text-xl font-bold text-white tracking-tight">{editingId ? 'Edit Method' : 'Add Payment Method'}</h2>
                   <p className="text-slate-400 text-xs mt-1">Configure your credit topup gateway</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                   <X size={20} />
                </button>
             </div>

             <form onSubmit={handleSubmit} className="p-8 space-y-8">
               
               {/* Basic Info Section */}
               <div className="grid md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-widest pl-1">Method Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-violet-500 focus:border-violet-500/50 outline-none transition-all text-sm"
                      placeholder="e.g. Bkash Personal"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-widest pl-1">Icon</label>
                    <div className="relative group">
                       <input
                         type="file"
                         accept="image/*"
                         onChange={(e) => handleImageUpload(e.target.files[0])}
                         className="hidden"
                         id="icon-upload"
                       />
                       <label htmlFor="icon-upload" className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-dashed border-white/10 bg-black/20 cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/10 transition-all group-hover:shadow-sm">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border border-white/10 ${image ? 'bg-white/5' : 'bg-white/5'}`}>
                             {image ? <img src={getImageUrl(image)} alt="Preview" className="w-full h-full object-contain" /> : <UploadCloud size={20} className="text-slate-400 group-hover:text-violet-400"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium text-slate-300 truncate">{image ? 'Icon Uploaded' : 'Click to Upload Icon'}</p>
                             <p className="text-[10px] text-slate-500">{uploading ? 'Uploading...' : 'SVG, PNG, JPG'}</p>
                          </div>
                       </label>
                    </div>
                 </div>
               </div>

               {/* Details Section */}
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest pl-1">Instructions / Bank Details</label>
                  <textarea
                     rows="4"
                     value={details}
                     onChange={(e) => setDetails(e.target.value)}
                     className="w-full px-4 py-3 rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-violet-500 focus:border-violet-500/50 outline-none transition-all text-sm resize-none"
                     placeholder="Enter detailed instructions for the user..."
                  ></textarea>
               </div>

               {/* Dynamic Fields Section */}
               <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-4">
                     <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Input Fields</h3>
                        <p className="text-[10px] text-slate-400 mt-1">Define what proofs you need from the user</p>
                     </div>
                     <button type="button" onClick={addField} className="text-[10px] font-bold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-lg shadow-violet-900/20 transition-all">
                        <Plus size={14} /> Add Field
                     </button>
                  </div>
                  
                  <div className="space-y-3">
                     {fields.map((field, index) => (
                       <div key={index} className="flex gap-3 items-center p-3 bg-black/40 rounded-xl border border-white/10 shadow-sm group hover:border-white/20 transition-all">
                          <div className="flex-1">
                             <input
                               type="text"
                               value={field.label}
                               onChange={(e) => updateField(index, 'label', e.target.value)}
                               placeholder="Label (e.g. Transaction ID)"
                               className="w-full px-3 py-2 rounded-lg border border-transparent bg-transparent focus:bg-white/5 outline-none transition-all text-xs font-medium text-white placeholder:text-slate-600"
                               required
                             />
                          </div>
                          <div className="w-32">
                             <select 
                               value={field.inputType}
                               onChange={(e) => updateField(index, 'inputType', e.target.value)}
                               className="w-full px-3 py-2 rounded-lg border border-transparent bg-white/5 text-slate-300 outline-none text-xs"
                             >
                               <option value="text">Text Input</option>
                               <option value="number">Number Input</option>
                               <option value="file">File Upload</option>
                             </select>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => removeField(index)}
                            className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            disabled={fields.length === 1}
                          >
                            <Trash size={14} />
                          </button>
                       </div>
                     ))}
                  </div>
               </div>

               {/* Footer */}
               <div className="pt-6 border-t border-white/5 flex justify-end gap-3">
                 <button
                   type="button"
                   onClick={() => setShowModal(false)}
                   className="px-6 py-3 rounded-xl border border-white/10 text-slate-400 font-semibold hover:bg-white/5 hover:text-white transition-colors text-xs uppercase tracking-wider"
                 >
                   Cancel
                 </button>
                 <button
                   type="submit"
                   disabled={uploading}
                   className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-xs uppercase tracking-wider"
                 >
                   {uploading ? 'Uploading...' : 'Create Method'}
                 </button>
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}
