import { Wrench, Calculator, Truck, Users, Shield, FileText, Zap, Globe, CheckCircle, ArrowRight, Mail, Building } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PitchOnePager() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-8 print:p-4">
        <div className="print:hidden mb-4 flex justify-end">
          <Button onClick={handlePrint} data-testid="btn-print">
            Print / Save as PDF
          </Button>
        </div>
        
        <div className="border border-gray-200 rounded-lg overflow-hidden print:border-none">
          <div className="bg-gradient-to-r from-[#0F2B4C] to-[#1a4a7a] p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center">
                  <span className="text-3xl font-bold text-[#0F2B4C]">TN</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">TrueNorth Trade OS</h1>
                  <p className="text-blue-200">AI-Powered Field Service Platform for UK Trade Businesses</p>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="text-blue-200">info@truenorthoperationsgroup.com</p>
                <p className="text-blue-200">Ashford, Kent, TN26 2NR</p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <h2 className="text-lg font-bold text-[#0F2B4C] mb-3 flex items-center gap-2">
                <div className="w-1 h-6 bg-red-500 rounded"></div>
                The Problem
              </h2>
              <p className="text-gray-700 text-sm mb-4">
                UK trade companies waste 30+ hours weekly on admin. Paper job sheets, fragmented software (4-7 different tools), compliance chaos, and no AI assistance. Hidden costs exceed £80k annually for a mid-size firm.
              </p>

              <h2 className="text-lg font-bold text-[#0F2B4C] mb-3 flex items-center gap-2">
                <div className="w-1 h-6 bg-green-500 rounded"></div>
                The Solution
              </h2>
              <p className="text-gray-700 text-sm mb-4">
                One platform that replaces everything. 8 integrated modules with AI that actually helps your engineers — researching suppliers, learning your pricing, remembering every conversation.
              </p>

              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Wrench className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Operations</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Calculator className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Finance</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Truck className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Fleet</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Workforce</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Shield className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Quality</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <FileText className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Compliance</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Globe className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">AI Search</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Zap className="w-5 h-5 text-pink-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">AI Learning</p>
                </div>
              </div>

              <h2 className="text-lg font-bold text-[#0F2B4C] mb-3 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-500 rounded"></div>
                AI Differentiators
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm"><strong>Web Search</strong> — Research suppliers, regs, products in seconds</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm"><strong>Business Learning</strong> — AI learns your pricing and materials</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm"><strong>Conversation Memory</strong> — Resume any chat anytime</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm"><strong>Trade Experts</strong> — Gas Safe, BS 7671 guidance on-site</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a] rounded-xl p-4 text-white">
                <h3 className="font-bold mb-3 text-center">ROI: 31-User Company (Year 1)</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-200">Year 1 Cost</span>
                    <span className="font-bold">£40,328</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Annual Savings</span>
                    <span className="font-bold">£131,200</span>
                  </div>
                  <div className="border-t border-white/20 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-blue-200">Net Benefit</span>
                      <span className="font-bold text-green-300">£90,872</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-blue-200">ROI</span>
                      <span className="font-bold text-green-300">225%</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-blue-200">Payback</span>
                      <span className="font-bold text-green-300">3.7 mo</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-bold text-[#0F2B4C] mb-3 text-center">Pricing</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Starter</span>
                    <span className="font-bold">£39/user</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Professional</span>
                    <span className="font-bold">£69/user</span>
                  </div>
                  <div className="flex justify-between bg-green-100 -mx-2 px-2 py-1 rounded">
                    <span className="font-medium">Business</span>
                    <span className="font-bold text-green-700">£99/user</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Enterprise</span>
                    <span className="font-bold">£149/user</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-bold text-[#0F2B4C] mb-2 text-center">Target Market</h3>
                <p className="text-sm text-gray-700 text-center">
                  UK trade companies: plumbing, gas, electrical, HVAC. 5-50 employees. £480M serviceable market.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>info@truenorthoperationsgroup.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span>Unit 2 Meadow View Industrial Estate, Ashford, Kent, TN26 2NR</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#0F2B4C]">
              <ArrowRight className="w-4 h-4" />
              <span>Book a Demo Today</span>
            </div>
          </div>
        </div>

        <div className="print:hidden mt-8 text-center text-gray-500 text-sm">
          <p>Use the Print button above to save as PDF or print this one-pager.</p>
        </div>
      </div>
    </div>
  );
}
