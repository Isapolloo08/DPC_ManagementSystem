import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { Fund, Donation } from "../types";
import { Heart, Plus, DollarSign, FileText, Printer, CheckCircle2, X } from "lucide-react";

export const GivingPage: React.FC = () => {
  const { user } = useAuth();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ name: string; description: string | null }[]>([]);
  const [isGiveModalOpen, setIsGiveModalOpen] = useState(false);
  const [statementData, setStatementData] = useState<any | null>(null);

  const [giveForm, setGiveForm] = useState({
    fund_id: "1",
    amount: "",
    method: "online",
    notes: ""
  });

  useEffect(() => {
    loadGivingData();
  }, []);

  const loadGivingData = async () => {
    try {
      const [fList, dList, methodsRes] = await Promise.all([
        api.getFunds(),
        api.getDonations(),
        api.getLookups({ type: "payment_method", active_only: true })
      ]);
      setFunds(fList);
      setDonations(dList);
      if (methodsRes && methodsRes.length > 0) {
        setPaymentMethods(methodsRes.map(m => ({ name: m.name, description: m.description })));
      }
    } catch (err) {
      console.error("Failed to load giving data:", err);
    }
  };

  const handleRecordDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordDonation({
        fund_id: Number(giveForm.fund_id),
        amount: Number(giveForm.amount),
        method: giveForm.method,
        notes: giveForm.notes
      });
      setIsGiveModalOpen(false);
      setGiveForm({ fund_id: "1", amount: "", method: "online", notes: "" });
      loadGivingData();
    } catch (err: any) {
      alert(err.message || "Failed to record donation");
    }
  };

  const handleGenerateStatement = async () => {
    try {
      const memberId = user?.member?.id || 2; // Default to Elena Santos if demo member
      const res = await api.getGivingStatement(memberId);
      setStatementData(res);
    } catch (err: any) {
      alert(err.message || "Failed to generate statement");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <Heart className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-charcoal tracking-tight">
              Giving & Stewardship
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-900 border border-indigo-200/80 shadow-2xs">
              Faithful Ministry Stewardship
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed">
            Ministry fund progress, tithes & offerings, and official tax contribution statements for church partners.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
          <button
            onClick={handleGenerateStatement}
            className="flex items-center gap-2 bg-white hover:bg-indigo-50/60 border border-indigo-200/80 text-charcoal font-bold px-4 py-2.5 rounded-2xl text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-indigo" />
            <span>My Tax Giving Statement</span>
          </button>
          <button
            onClick={() => setIsGiveModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <DollarSign className="w-4 h-4 text-indigo-950" />
            <span>Give / Record Contribution</span>
          </button>
        </div>
      </div>

      {/* Funds Goals Meter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {funds.map((fund) => {
          const raised = fund.raised_amount || 0;
          const target = fund.target_amount || 1;
          const pct = Math.min(100, Math.round((raised / target) * 100));

          return (
            <div key={fund.id} className="bg-white/95 rounded-3xl p-6 border border-indigo-100/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                    <Heart className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full shadow-2xs">
                    {pct}% Funded
                  </span>
                </div>

                <h3 className="font-black text-base text-charcoal">{fund.name}</h3>
                <p className="text-xs text-charcoal/70 line-clamp-2 mt-1 leading-relaxed">
                  {fund.description}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-xs font-black mb-2">
                  <span className="text-indigo-900">${raised.toLocaleString()}</span>
                  <span className="text-charcoal/50 font-medium">Goal: ${target.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Donations Ledger Table */}
      <div className="bg-white/95 rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-indigo-100/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-black text-charcoal text-sm">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <DollarSign className="w-4 h-4" />
            </span>
            <span>Contribution History</span>
          </div>
          <span className="text-xs text-charcoal/50 font-normal">({donations.length} recorded gifts)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-indigo-50/40 text-charcoal/80 uppercase text-[11px] font-black tracking-wider border-b border-indigo-100/80">
              <tr>
                <th className="py-3.5 px-5">Donor Name</th>
                <th className="py-3.5 px-5">Fund Designation</th>
                <th className="py-3.5 px-5">Amount</th>
                <th className="py-3.5 px-5">Payment Method</th>
                <th className="py-3.5 px-5">Notes</th>
                <th className="py-3.5 px-5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50 font-medium">
              {donations.map((d) => (
                <tr key={d.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="py-4 px-5 font-black text-charcoal">
                    {d.first_name ? `${d.first_name} ${d.last_name}` : "Anonymous / Direct"}
                  </td>
                  <td className="py-4 px-5 font-semibold text-charcoal/80">{d.fund_name}</td>
                  <td className="py-4 px-5 font-black text-indigo-900">${d.amount.toFixed(2)}</td>
                  <td className="py-4 px-5">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-900 border border-indigo-100">
                      {d.method}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-charcoal/60">{d.notes || "—"}</td>
                  <td className="py-4 px-5 text-right text-charcoal/50 font-medium">
                    {new Date(d.donated_at).toLocaleDateString([], { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Donation Modal */}
      {isGiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-black text-charcoal flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <span>Give / Record Contribution</span>
              </h2>
              <button onClick={() => setIsGiveModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordDonation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Fund Designation *</label>
                <select
                  value={giveForm.fund_id}
                  onChange={(e) => setGiveForm({ ...giveForm, fund_id: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-bold text-indigo-900 cursor-pointer"
                >
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Gift Amount ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="100.00"
                  value={giveForm.amount}
                  onChange={(e) => setGiveForm({ ...giveForm, amount: e.target.value })}
                  className="w-full bg-ivory-light font-black text-base p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Payment Method</label>
                <select
                  value={giveForm.method}
                  onChange={(e) => setGiveForm({ ...giveForm, method: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-bold text-charcoal cursor-pointer"
                >
                  {paymentMethods.length > 0 ? (
                    paymentMethods.map((pm) => (
                      <option key={pm.name} value={pm.name}>{pm.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="Cash">Cash (Envelope)</option>
                      <option value="GCash">GCash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Check">Check</option>
                      <option value="Online Giving">Online Giving</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Notes / Dedication</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly tithe, Missions pledge"
                  value={giveForm.notes}
                  onChange={(e) => setGiveForm({ ...giveForm, notes: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-medium"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGiveModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black shadow-md cursor-pointer active:scale-95"
                >
                  Complete Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Giving Statement Printable Modal */}
      {statementData && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-indigo-100 animate-scale-up">
            {/* Statement Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-700">OFFICIAL ANNUAL CONTRIBUTION STATEMENT</div>
                <h2 className="text-xl font-serif font-black text-charcoal mt-0.5">{statementData.organization}</h2>
                <p className="text-xs text-charcoal/50">Tax ID / 501(c)(3): {statementData.tax_id}</p>
              </div>
              <button onClick={() => setStatementData(null)} className="p-1 text-charcoal/50 hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Member & Tax Year */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-ivory-light/90 p-5 rounded-2xl border border-amber-200/60">
              <div>
                <span className="text-charcoal/50 block font-bold">DONOR:</span>
                <span className="font-black text-base text-indigo-950">{statementData.member.name}</span>
                <p className="text-charcoal/70 mt-0.5">{statementData.member.address}</p>
                <p className="text-charcoal/70">{statementData.member.email}</p>
              </div>
              <div className="text-right">
                <span className="text-charcoal/50 block font-bold">TAX YEAR:</span>
                <span className="font-mono font-black text-base text-charcoal">{statementData.statement_year}</span>
                <p className="text-charcoal/50 mt-1 font-medium">Issued: {new Date(statementData.issued_date).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Giving Breakdown Table */}
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-charcoal/70 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Fund</th>
                  <th className="p-2.5">Method</th>
                  <th className="p-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statementData.records.map((r: any) => (
                  <tr key={r.id}>
                    <td className="p-2.5 text-charcoal/60">{new Date(r.donated_at).toLocaleDateString()}</td>
                    <td className="p-2.5 font-semibold text-charcoal">{r.fund_name}</td>
                    <td className="p-2.5 uppercase text-[10px] text-charcoal/60">{r.method}</td>
                    <td className="p-2.5 text-right font-bold text-charcoal">${r.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-charcoal">
                <tr>
                  <td colSpan={3} className="p-3 font-bold text-sm text-charcoal">Total Tax-Deductible Contributions:</td>
                  <td className="p-3 text-right font-black text-base text-indigo-900">${statementData.total_giving.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="text-[11px] text-charcoal/60 italic border-t border-gray-100 pt-3">
              * No goods or services were provided in exchange for this contribution other than intangible religious benefits. Thank you for your faithful stewardship and support of God's work.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setStatementData(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-xs text-charcoal cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-indigo-900 hover:bg-indigo-800 text-white font-black text-xs shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Print Official Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
