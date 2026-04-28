import React, { useEffect, useState } from "react";
import api, {
  createPaymentMethodPage,
  getPaymentMethodPages,
  getMyPaymentMethods,
  updatePaymentMethodPage,
  deletePaymentMethodPage,
  uploadPaymentPageImage,
} from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { CreditCard, Sun, Moon, Plus, Trash2, Edit, Palette } from "lucide-react";

export default function AddPaymentPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [pages, setPages] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [allMethods, setAllMethods] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    methodName: "",
    note: "",
    image: "",
    importantNote: "",
    depositMethod: "bkash",
    color: "#000000",
    bgColor: "#ffffff",
    buttonText: "",
    buttonTextColor: "#ffffff",
    buttonTextBgColor: "#4f46e5",
    details: [],
    paymentMethod: "",
  });
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([getPaymentMethodPages(token), getMyPaymentMethods(token)])
      .then(([pageData, res]) => {
        setPages(pageData);
        if (res.success && Array.isArray(res.data)) {
          setAllMethods(res.data);
          const usedIds = new Set(pageData.map((p) => String(p.paymentMethod?._id || p.paymentMethod)));
          const filtered = res.data.filter((pm) => !usedIds.has(String(pm._id)));
          setPaymentMethods(filtered);
        } else {
          setAllMethods([]);
          setPaymentMethods([]);
        }
      })
      .catch(console.warn);
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updatePaymentMethodPage(token, editingId, form);
      } else {
        await createPaymentMethodPage(token, form);
      }
      const updated = await getPaymentMethodPages(token);
      setPages(updated);
      resetForm();
    } catch (err) {
      alert("Failed to save payment method page");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      methodName: "",
      note: "",
      image: "",
      importantNote: "",
      depositMethod: "bkash",
      color: "#000000",
      bgColor: "#ffffff",
      buttonText: "",
      buttonTextColor: "#ffffff",
      buttonTextBgColor: "#4f46e5",
      details: [],
      paymentMethod: "",
    });
    setEditingId(null);
  };

  const startEdit = (page) => {
    setEditingId(page._id);
    setForm({
      methodName: page.methodName || "",
      note: page.note || "",
      image: page.image || "",
      importantNote: page.importantNote || "",
      depositMethod: page.depositMethod || "bkash",
      color: page.color || "#000000",
      bgColor: page.bgColor || "#ffffff",
      buttonText: page.buttonText || "",
      buttonTextColor: page.buttonTextColor || "#ffffff",
      buttonTextBgColor: page.buttonTextBgColor || "#4f46e5",
      details: Array.isArray(page.details) ? page.details : [],
      paymentMethod: page.paymentMethod?._id || page.paymentMethod || "",
    });
  };

  const removePage = async (id) => {
    if (!confirm("এই পেমেন্ট পেজটি মুছে ফেলতে চান?")) return;
    try {
      await deletePaymentMethodPage(token, id);
      const updated = await getPaymentMethodPages(token);
      setPages(updated);
    } catch (err) {
      alert("মুছে ফেলতে সমস্যা হয়েছে");
    }
  };

  return (
    <div
      className={`min-h-screen transition-all duration-500 ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-purple-900 to-slate-900"
          : "bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50"
      } p-4 md:p-6 lg:p-8`}
    >
      {/* Dark Mode Toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-6 right-6 p-3 rounded-xl shadow-xl backdrop-blur-xl border transition-all z-50 ${
          darkMode
            ? "bg-gray-800/80 border-gray-700 hover:bg-gray-700"
            : "bg-white/80 border-white/50 hover:bg-gray-50"
        }`}
      >
        {darkMode ? (
          <Sun className="w-5 h-5 text-yellow-400" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-600" />
        )}
      </button>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-2xl backdrop-blur-xl ${
              darkMode
                ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                : "bg-gradient-to-br from-emerald-400 to-teal-500"
            }`}
          >
            <CreditCard className="w-9 h-9 text-white" />
          </div>
          <h1
            className={`text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${
              darkMode
                ? "from-pink-400 to-purple-400"
                : "from-violet-600 to-pink-600"
            }`}
          >
            পেমেন্ট পেজ ম্যানেজার
          </h1>
          <p className={`mt-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            {user?.role === 'wallet_agent'
              ? 'Wallet Agent এর জন্য পেমেন্ট পেজ admin আগে থেকে সেট করে রেখেছে। এখানে শুধু দেখাতে পারবেন।'
              : 'নতুন পেমেন্ট পেজ তৈরি করুন বা পুরোনো এডিট করুন'}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Form Card */}
          {user?.role !== 'wallet_agent' && (
            <div
              className={`rounded-3xl shadow-2xl p-6 md:p-8 backdrop-blur-2xl border transition-all duration-300 ${
                darkMode
                  ? "bg-gray-800/70 border-gray-700"
                  : "bg-white/90 border-white/30"
              }`}
            >
              <h3 className={`text-2xl font-bold mb-6 flex items-center gap-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                <Plus className="w-6 h-6 text-emerald-500" />
                {editingId ? "এডিট পেজ" : "নতুন পেজ"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-5">
              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    মেথড নাম *
                  </label>
                  <input
                    name="methodName"
                    value={form.methodName}
                    onChange={handleChange}
                    placeholder="যেমন: বিকাশ পার্সোনাল"
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                      darkMode
                        ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    ডিপোজিট মেথড
                  </label>
                  <select
                    name="depositMethod"
                    value={form.depositMethod}
                    onChange={handleChange}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                      darkMode
                        ? "bg-gray-700/50 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="bkash">বিকাশ</option>
                    <option value="rocket">রকেট</option>
                    <option value="nagad">নগদ</option>
                    <option value="upay">উপায়</option>
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  নোট (ঐচ্ছিক)
                </label>
                <input
                  name="note"
                  value={form.note}
                  onChange={handleChange}
                  placeholder="যেমন: শুধুমাত্র পার্সোনাল"
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                    darkMode
                      ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  ইমেজ আপলোড (ঐচ্ছিক)
                </label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await uploadPaymentPageImage(token, file);
                          if (res?.url) {
                            setForm((prev) => ({ ...prev, image:   res.url }));
                          }
                        } catch (err) {
                          alert(err.message || 'আপলোড ব্যর্থ হয়েছে');
                        }
                      }}
                      className={`w-full cursor-pointer file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                    />
                    {form.image && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, image: '' }))}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700"
                      >মুছুন</button>
                    )}
                  </div>
                  {form.image && (
                    <div className="rounded-xl p-2 border flex items-center justify-center max-h-40 bg-gray-50 dark:bg-gray-800">
                      <img
                        src={form.image}
                        alt="Preview"
                        className="max-h-36 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Row 4 */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  গুরুত্বপূর্ণ নোট
                </label>
                <input
                  name="importantNote"
                  value={form.importantNote}
                  onChange={handleChange}
                  placeholder="যেমন: ৫ মিনিটের মধ্যে পেমেন্ট করুন"
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                    darkMode
                      ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              {/* Color Pickers (removed buttonColor slot) */}
              <div>
                <label className={`block text-sm font-medium mb-3 flex items-center gap-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <Palette className="w-4 h-4" /> কালার সিলেক্ট করুন
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {["color", "bgColor", "buttonTextColor", "buttonTextBgColor"].map((field) => (
                    <div key={field} className="flex flex-col items-center">
                      <input
                        type="color"
                        name={field}
                        value={form[field]}
                        onChange={handleChange}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-300 shadow-sm"
                      />
                      <span className={`text-xs mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        {field === "color" ? "টেক্সট" : field === "bgColor" ? "ব্যাকগ্রাউন্ড" : field === "buttonTextColor" ? "বাটন টেক্সট" : "বাটন BG"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>


              {/* Details */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  ডিটেইলস
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={form.detailsInput || ""}
                    onChange={(e) => setForm((f) => ({ ...f, detailsInput: e.target.value }))}
                    onKeyPress={(e) => e.key === "Enter" && e.preventDefault()}
                    placeholder="ডিটেইল লিখুন..."
                    className={`flex-1 px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                      darkMode
                        ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (form.detailsInput?.trim()) {
                        setForm((f) => ({
                          ...f,
                          details: [...f.details, f.detailsInput.trim()],
                          detailsInput: "",
                        }));
                      }
                    }}
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.details.map((d, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
                        darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, details: f.details.filter((_, idx) => idx !== i) }))}
                        className="ml-1 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  পেমেন্ট মেথড *
                </label>
                <select
                  name="paymentMethod"
                  value={form.paymentMethod}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                    darkMode
                      ? "bg-gray-700/50 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                  required
                >
                  <option value="">পেমেন্ট মেথড সিলেক্ট করুন</option>
                  {editingId &&
                    form.paymentMethod &&
                    !paymentMethods.find((pm) => pm._id === form.paymentMethod) &&
                    allMethods
                      .filter((pm) => pm._id === form.paymentMethod)
                      .map((pm) => (
                        <option key={pm._id} value={pm._id}>
                          {pm.provider} - {pm.accountNumber} (SIM {pm.simIndex})
                        </option>
                      ))}
                  {paymentMethods.map((pm) => (
                    <option key={pm._id} value={pm._id}>
                      {pm.provider} - {pm.accountNumber} (SIM {pm.simIndex})
                    </option>
                  ))}
                </select>
              </div>

              {/* Button Text */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  বাটন টেক্সট
                </label>
                <input
                  name="buttonText"
                  value={form.buttonText}
                  onChange={handleChange}
                  placeholder="যেমন: পেমেন্ট করুন"
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                    darkMode
                      ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>
              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-xl flex items-center justify-center gap-2 ${
                  loading
                    ? "bg-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                }`}
              >
                {loading ? (
                  "সেভ হচ্ছে..."
                ) : editingId ? (
                  <>
                    <Edit className="w-5 h-5" /> আপডেট করুন
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" /> পেজ তৈরি করুন
                  </>
                )}
              </button>
              </form>
            </div>
          )}

          {/* List Card */}
          <div
            className={`rounded-3xl shadow-2xl p-6 md:p-8 backdrop-blur-2xl border transition-all duration-300 overflow-hidden ${
              darkMode
                ? "bg-gray-800/70 border-gray-700"
                : "bg-white/90 border-white/30"
            }`}
          >
            <h3 className={`text-2xl font-bold mb-6 ${darkMode ? "text-white" : "text-gray-900"}`}>
              তোমার পেমেন্ট পেজসমূহ
            </h3>

            <div className="mb-2 h-full max-h-full overflow-y-auto pr-2 custom-scrollbar">
              {pages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                    <CreditCard className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className={`text-lg ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    কোনো পেমেন্ট পেজ তৈরি করা হয়নি
                  </p>
                </div>
              ) : (
                pages.map((page) => {
                  const pmPopulated = page.paymentMethod && typeof page.paymentMethod === "object" ? page.paymentMethod : null;
                  const pm = pmPopulated || allMethods.find((m) => String(m._id) === String(page.paymentMethod));
                  const isSystem = !!page.isSystem;

                  return (
                    <div
                      key={page._id}
                      className={`mb-2 relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${
                        darkMode
                          ? "bg-gray-900/80 border-gray-700"
                          : "bg-white/95 border-gray-200"
                      }`}
                    >
                      {/* Gradient Top Bar */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>

                      <div className="p-6">
                        {/* Header: Name + Actions */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                              {page.methodName}
                            </h4>
                            <p className={`text-sm ${darkMode ? "text-emerald-400" : "text-emerald-600"} font-medium`}>
                              {page.depositMethod.toUpperCase()}
                              {pm && ` • SIM ${pm.simIndex}`}
                            </p>
                          </div>
                          <div className="flex gap-2 items-center">
                            {isSystem && (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                অ্যাডমিন পেজ
                              </span>
                            )}
                            {!isSystem && (
                              <>
                                <button
                                  onClick={() => startEdit(page)}
                                  className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg"
                                  title="এডিট"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removePage(page._id)}
                                  className="p-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg"
                                  title="ডিলিট"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Payment Method */}
                        {pm && (
                          <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${
                            darkMode ? "bg-gray-800" : "bg-gray-50"
                          }`}>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                              {pm.provider[0].toUpperCase()}
                            </div>
                            <div>
                              <p className={`font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                                {pm.provider} - {pm.accountNumber}
                              </p>
                              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                                SIM {pm.simIndex}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Image Preview */}
                        {page.image && (
                          <div className="mb-4">
                            <img
                              src={ import.meta.env.VITE_API_URL + page.image}
                              alt="Payment Logo"
                              className="w-full h-32 object-contain rounded-xl bg-gray-100 dark:bg-gray-800 p-2"
                              onError={(e) => (e.target.style.display = "none")}
                            />
                          </div>
                        )}

                        {/* Important Note */}
                        {page.importantNote && (
                          <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                            <p className="text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-2">
                            {page.importantNote}
                            </p>
                          </div>
                        )}

                        {/* Note */}
                        {page.note && (
                          <p className={`text-sm mb-3 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                            <span className="font-medium">নোট:</span> {page.note}
                          </p>
                        )}

                        {/* Details List */}
                        {page.details && page.details.length > 0 && (
                          <div className="mb-4">
                            <p className={`text-sm font-medium mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                              ডিটেইলস:
                            </p>
                            <ul className={`space-y-1.5 text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                              {page.details.map((d, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-emerald-500 mt-1">•</span>
                                  <span>{d}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Color Previews */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {[{label:'টেক্সট',value:page.color},{label:'ব্যাকগ্রাউন্ড',value:page.bgColor},{label:'বাটন BG',value:page.buttonTextBgColor}].map((c,i)=>(
                            <div key={i} className={`p-3 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{c.label}</p>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg border-2 border-gray-300" style={{backgroundColor:c.value}}></div>
                                <span className={`text-xs font-mono ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{c.value}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Button Preview */}
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">বাটন প্রিভিউ</p>
                          <button
                            className="px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md"
                            style={{
                              backgroundColor: page.buttonTextBgColor,
                              color: page.buttonTextColor,
                            }}
                          >
                            {page.buttonText || "পেমেন্ট করুন"}
                          </button>
                          <div className="flex gap-2 mt-2 text-xs">
                            <span className={`font-mono ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                              BG: {page.buttonTextBgColor}
                            </span>
                            <span className={`font-mono ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                              Text: {page.buttonTextColor}
                            </span>
                          </div>
                        </div>

                        {/* Button Text BG Color */}
                        {page.buttonTextBgColor && page.buttonTextBgColor !== page.buttonColor && (
                          <div className={`p-3 rounded-xl ${darkMode ? "bg-gray-800" : "bg-gray-50"}`}>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">বাটন টেক্সট BG</p>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-lg border-2 border-gray-300"
                                style={{ backgroundColor: page.buttonTextBgColor }}
                              ></div>
                              <span className={`text-xs font-mono ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                                {page.buttonTextBgColor}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}