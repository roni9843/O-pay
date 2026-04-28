import React from 'react';

export default function KYCSummary({ formData }) {
    if (!formData) return null;

    // Safety check for optional nested objects
    const company = formData.company || {};
    const address = company.address || {};
    const primaryContact = formData.primaryContact || {};
    const site = formData.site || {};
    const banking = formData.banking || [];
    const mfs = formData.mfs || [];

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Company Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SummaryItem label="Company Name" value={company.name} />
                    <SummaryItem label="MD Name" value={company.mdName} />
                    <SummaryItem label="MD Mobile" value={company.mdMobile} />
                    <SummaryItem label="Trade License" value={company.tradeLicenseNo || "N/A"} />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Contact & Site</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SummaryItem label="Primary Contact" value={primaryContact.name} />
                    <SummaryItem label="Phone" value={primaryContact.phone} />
                    <SummaryItem label="Website" value={site.url} />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">Address</h4>
                    <p className="text-sm text-slate-600">
                        {address.details}, {address.thana}, {address.district} - {address.division}
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Accounts</h3>
                <div>
                    <h4 className="font-bold text-sm text-slate-700 mb-2">Banking</h4>
                    {banking.length > 0 ? (
                        <ul className="list-disc ml-5 text-sm text-slate-600">
                            {banking.map((b, i) => <li key={i}>{b.bankName} - {b.accountNo}</li>)}
                        </ul>
                    ) : <span className="text-sm text-slate-500">None</span>}
                </div>
                <div className="mt-4">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">MFS</h4>
                    {mfs.length > 0 ? (
                        <ul className="list-disc ml-5 text-sm text-slate-600">
                            {mfs.map((m, i) => <li key={i}>{m.provider} ({m.type}) - {m.number}</li>)}
                        </ul>
                    ) : <span className="text-sm text-slate-500">None</span>}
                </div>
            </div>
        </div>
    )
}

function SummaryItem({ label, value }) {
    return (
        <div>
            <label className="block text-xs uppercase text-slate-500 font-bold">{label}</label>
            <div className="text-sm font-medium text-slate-900 break-words">{value}</div>
        </div>
    )
}
