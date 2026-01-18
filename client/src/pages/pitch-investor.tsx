import { useState } from "react";
import { ChevronLeft, ChevronRight, Target, TrendingUp, Users, Zap, DollarSign, Award, Rocket, BarChart3, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const slides = [
  {
    id: 1,
    title: "TrueNorth Trade OS",
    subtitle: "The AI-Powered Field Service Platform for UK Trade Businesses",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-lg">
          <span className="text-6xl font-bold text-[#0F2B4C]">TN</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4">TrueNorth Trade OS</h1>
        <p className="text-2xl text-blue-100 mb-8">The AI-Powered Field Service Platform for UK Trade Businesses</p>
        <div className="flex gap-4 text-blue-200">
          <span className="px-4 py-2 bg-white/10 rounded-full">Plumbing</span>
          <span className="px-4 py-2 bg-white/10 rounded-full">Electrical</span>
          <span className="px-4 py-2 bg-white/10 rounded-full">HVAC</span>
          <span className="px-4 py-2 bg-white/10 rounded-full">Gas</span>
        </div>
      </div>
    ),
    bgClass: "bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a]"
  },
  {
    id: 2,
    title: "The Problem",
    subtitle: "UK Trade Businesses Are Drowning in Admin",
    content: (
      <div className="grid grid-cols-2 gap-8 h-full items-center">
        <div>
          <h2 className="text-4xl font-bold text-[#0F2B4C] mb-6">The Problem</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-red-600 font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Paper-Based Chaos</h3>
                <p className="text-gray-600">Job sheets, timesheets, and expenses still on paper. Lost documents cost £5k+ annually.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-red-600 font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Fragmented Software</h3>
                <p className="text-gray-600">4-7 different tools for jobs, invoicing, fleet, messaging. No integration.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-red-600 font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Compliance Nightmare</h3>
                <p className="text-gray-600">Gas Safe, BS 7671, HMRC mileage - manual tracking leads to errors and fines.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-red-600 font-bold">4</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">No AI Assistance</h3>
                <p className="text-gray-600">Engineers waste 30+ mins daily researching suppliers, regs, and specifications.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-red-50 rounded-2xl p-8 h-full flex flex-col justify-center">
          <h3 className="text-2xl font-bold text-red-800 mb-6 text-center">The Hidden Costs</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-white rounded-lg">
              <span className="font-medium">Admin time wasted</span>
              <span className="text-2xl font-bold text-red-600">30 hrs/week</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white rounded-lg">
              <span className="font-medium">Lost productivity</span>
              <span className="text-2xl font-bold text-red-600">£52k/year</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white rounded-lg">
              <span className="font-medium">Software sprawl</span>
              <span className="text-2xl font-bold text-red-600">£8k/year</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white rounded-lg">
              <span className="font-medium">Errors & rework</span>
              <span className="text-2xl font-bold text-red-600">£12k/year</span>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 3,
    title: "The Solution",
    subtitle: "One Platform. AI-Powered. UK-Focused.",
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-[#0F2B4C] mb-2 text-center">The Solution</h2>
        <p className="text-xl text-gray-600 mb-8 text-center">One Platform. AI-Powered. Built for UK Trades.</p>
        <div className="grid grid-cols-4 gap-4 flex-1">
          <div className="bg-blue-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">Operations</h3>
            <p className="text-sm text-gray-600 flex-1">Jobs, quotes, invoices, scheduling - all connected</p>
          </div>
          <div className="bg-green-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">Finance</h3>
            <p className="text-sm text-gray-600 flex-1">Timesheets, expenses, payments with approval workflows</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">Fleet</h3>
            <p className="text-sm text-gray-600 flex-1">Vehicles, walkaround checks, defect management</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">Workforce</h3>
            <p className="text-sm text-gray-600 flex-1">Staff, skills, GPS tracking, certifications</p>
          </div>
          <div className="bg-red-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">Quality</h3>
            <p className="text-sm text-gray-600 flex-1">Inspections, snagging, photo evidence</p>
          </div>
          <div className="bg-teal-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center mb-4">
              <Award className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">Compliance</h3>
            <p className="text-sm text-gray-600 flex-1">Gas Safe, BS 7671, HMRC rates built-in</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">AI Intelligence</h3>
            <p className="text-sm text-gray-600 flex-1">Web search, learning, memory, expert advisors</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 flex flex-col">
            <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2">File Storage</h3>
            <p className="text-sm text-gray-600 flex-1">Centralized docs with smart AI assignment</p>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 4,
    title: "AI Differentiator",
    subtitle: "Intelligence No Competitor Can Match",
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-white mb-2 text-center">Our AI Advantage</h2>
        <p className="text-xl text-blue-100 mb-8 text-center">Features no competitor offers at any price</p>
        <div className="grid grid-cols-2 gap-6 flex-1">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Web Search</h3>
            </div>
            <p className="text-blue-100">"Find me the best price for a Vaillant ecoTEC boiler" - AI searches suppliers, compares prices, returns clickable links. 30 mins research in 30 seconds.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Business Learning</h3>
            </div>
            <p className="text-blue-100">AI learns from your jobs, quotes, and materials. Suggests accurate pricing based on YOUR historical data. Gets smarter every day.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Conversation Memory</h3>
            </div>
            <p className="text-blue-100">Resume any chat anytime. AI remembers context across all conversations. "What did we discuss about the Smith job?" - instant recall.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Trade Experts</h3>
            </div>
            <p className="text-blue-100">Gas Safe certified? BS 7671 compliant? AI advisors trained on UK regulations give instant expert guidance on-site.</p>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a]"
  },
  {
    id: 5,
    title: "Market Opportunity",
    subtitle: "£2.4B UK Field Service Software Market",
    content: (
      <div className="grid grid-cols-2 gap-8 h-full items-center">
        <div>
          <h2 className="text-4xl font-bold text-[#0F2B4C] mb-6">Market Opportunity</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-600">Total Addressable Market</h3>
              <p className="text-4xl font-bold text-[#0F2B4C]">£2.4B</p>
              <p className="text-gray-500">UK Field Service Management Software</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-600">Serviceable Market</h3>
              <p className="text-4xl font-bold text-[#0F2B4C]">£480M</p>
              <p className="text-gray-500">SMB Trade Companies (5-50 employees)</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-600">Initial Target</h3>
              <p className="text-4xl font-bold text-[#0F2B4C]">£48M</p>
              <p className="text-gray-500">Gas, Electrical, Plumbing specialists</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-2xl p-8 h-full flex flex-col justify-center">
          <h3 className="text-2xl font-bold text-[#0F2B4C] mb-6">Why Now?</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p><strong>AI Revolution:</strong> GPT-4 enables features previously impossible</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p><strong>Post-COVID Digital:</strong> Trade businesses finally ready for software</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p><strong>Labour Shortage:</strong> Must do more with less - automation critical</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p><strong>Regulation Pressure:</strong> Gas Safe, Building Safety Act driving compliance needs</p>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 6,
    title: "Competition",
    subtitle: "ServiceTitan Features at Half the Price",
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-[#0F2B4C] mb-2 text-center">Competitive Landscape</h2>
        <p className="text-xl text-gray-600 mb-6 text-center">We deliver enterprise features at SMB prices</p>
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4">Feature</th>
                <th className="text-center py-3 px-4 bg-green-50">
                  <span className="font-bold text-green-700">TrueNorth</span>
                  <br /><span className="text-sm text-gray-500">£99/user</span>
                </th>
                <th className="text-center py-3 px-4">
                  <span className="font-bold">ServiceTitan</span>
                  <br /><span className="text-sm text-gray-500">£200/user</span>
                </th>
                <th className="text-center py-3 px-4">
                  <span className="font-bold">BigChange</span>
                  <br /><span className="text-sm text-gray-500">£80/user</span>
                </th>
                <th className="text-center py-3 px-4">
                  <span className="font-bold">Simpro</span>
                  <br /><span className="text-sm text-gray-500">£100/user</span>
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b"><td className="py-2 px-4">Job Management</td><td className="text-center text-green-600">✓</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
              <tr className="border-b bg-gray-50"><td className="py-2 px-4">Fleet Tracking</td><td className="text-center text-green-600">✓</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center text-red-600">✗</td></tr>
              <tr className="border-b"><td className="py-2 px-4">UK Compliance Built-in</td><td className="text-center text-green-600">✓</td><td className="text-center text-red-600">✗</td><td className="text-center">✓</td><td className="text-center text-red-600">✗</td></tr>
              <tr className="border-b bg-gray-50"><td className="py-2 px-4 font-semibold">AI Web Search</td><td className="text-center text-green-600 font-bold">✓</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td></tr>
              <tr className="border-b"><td className="py-2 px-4 font-semibold">AI Business Learning</td><td className="text-center text-green-600 font-bold">✓</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td></tr>
              <tr className="border-b bg-gray-50"><td className="py-2 px-4 font-semibold">AI Conversation Memory</td><td className="text-center text-green-600 font-bold">✓</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td></tr>
              <tr className="border-b"><td className="py-2 px-4">White Label Option</td><td className="text-center text-green-600">✓</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td><td className="text-center text-red-600">✗</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-4 bg-green-50 rounded-xl text-center">
          <p className="text-lg font-semibold text-green-800">TrueNorth: ServiceTitan features + unique AI capabilities at 50% of the cost</p>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 7,
    title: "Business Model",
    subtitle: "SaaS with High LTV and Low Churn",
    content: (
      <div className="grid grid-cols-2 gap-8 h-full items-center">
        <div>
          <h2 className="text-4xl font-bold text-[#0F2B4C] mb-6">Business Model</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <h3 className="font-bold text-lg">Revenue Streams</h3>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li>• Implementation fees: £500-£7,500</li>
                <li>• Monthly subscriptions: £39-£149/user</li>
                <li>• Add-ons: SMS, integrations, storage</li>
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <h3 className="font-bold text-lg">Unit Economics</h3>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li>• Average contract value: £18k/year</li>
                <li>• Gross margin: 85%</li>
                <li>• Target churn: &lt;5% annually</li>
                <li>• LTV:CAC ratio: 8:1</li>
              </ul>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <h3 className="font-bold text-lg">Growth Levers</h3>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li>• Land & expand (add users over time)</li>
                <li>• Tier upgrades (Starter → Business)</li>
                <li>• Referral programme (trade networks)</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="h-full flex flex-col justify-center">
          <h3 className="text-2xl font-bold text-[#0F2B4C] mb-6 text-center">Pricing Tiers</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
              <div>
                <span className="font-bold">Starter</span>
                <span className="text-gray-500 ml-2">Solo/Micro</span>
              </div>
              <span className="text-xl font-bold">£39/user</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-100 rounded-lg">
              <div>
                <span className="font-bold">Professional</span>
                <span className="text-gray-500 ml-2">3-10 users</span>
              </div>
              <span className="text-xl font-bold">£69/user</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-100 rounded-lg border-2 border-green-500">
              <div>
                <span className="font-bold">Business</span>
                <span className="text-gray-500 ml-2">10-25 users</span>
                <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded">POPULAR</span>
              </div>
              <span className="text-xl font-bold">£99/user</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-purple-100 rounded-lg">
              <div>
                <span className="font-bold">Enterprise</span>
                <span className="text-gray-500 ml-2">25+ users</span>
              </div>
              <span className="text-xl font-bold">£149/user</span>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 8,
    title: "ROI Case Study",
    subtitle: "Real Numbers from a 31-User Company",
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-white mb-2 text-center">Customer ROI</h2>
        <p className="text-xl text-blue-100 mb-6 text-center">31 users • 24 vehicles • Business tier</p>
        <div className="grid grid-cols-3 gap-6 flex-1">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-blue-200 mb-4">Investment</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-blue-100">Implementation</span>
                <span className="font-bold text-white">£3,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-100">Monthly (31×£99)</span>
                <span className="font-bold text-white">£3,069</span>
              </div>
              <div className="border-t border-white/20 pt-3 flex justify-between">
                <span className="text-blue-100">Year 1 Total</span>
                <span className="font-bold text-white text-xl">£40,328</span>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-blue-200 mb-4">Annual Savings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-100">Admin time</span>
                <span className="text-white">£31,200</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-100">Engineer productivity</span>
                <span className="text-white">£52,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-100">Software consolidation</span>
                <span className="text-white">£8,400</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-100">Fuel savings</span>
                <span className="text-white">£7,200</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-100">Reduced errors</span>
                <span className="text-white">£12,000</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between">
                <span className="text-blue-100 font-semibold">Total</span>
                <span className="font-bold text-white text-xl">£131,200</span>
              </div>
            </div>
          </div>
          <div className="bg-green-500/20 backdrop-blur rounded-xl p-6 border border-green-400/30">
            <h3 className="text-lg font-semibold text-green-200 mb-4">Results</h3>
            <div className="space-y-4">
              <div className="text-center p-3 bg-white/10 rounded-lg">
                <p className="text-green-200 text-sm">Net Benefit Y1</p>
                <p className="text-3xl font-bold text-white">£90,872</p>
              </div>
              <div className="text-center p-3 bg-white/10 rounded-lg">
                <p className="text-green-200 text-sm">ROI</p>
                <p className="text-3xl font-bold text-white">225%</p>
              </div>
              <div className="text-center p-3 bg-white/10 rounded-lg">
                <p className="text-green-200 text-sm">Payback Period</p>
                <p className="text-3xl font-bold text-white">3.7 mo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a]"
  },
  {
    id: 9,
    title: "Traction",
    subtitle: "Built and Ready to Scale",
    content: (
      <div className="grid grid-cols-2 gap-8 h-full items-center">
        <div>
          <h2 className="text-4xl font-bold text-[#0F2B4C] mb-6">Traction & Milestones</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-bold">Full Platform Built</h3>
                <p className="text-gray-600">8 modules, AI integration, mobile PWA</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-bold">AI Differentiators Live</h3>
                <p className="text-gray-600">Web search, learning, memory - all working</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold">Ready for Pilot Customers</h3>
                <p className="text-gray-600">Seeking 5 beta customers for Q1</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-xl">
              <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">→</span>
              </div>
              <div>
                <h3 className="font-bold">Target: 50 Customers by EOY</h3>
                <p className="text-gray-600">~£900k ARR goal</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a] rounded-2xl p-8 h-full flex flex-col justify-center text-white">
          <h3 className="text-2xl font-bold mb-6 text-center">5-Year Projections</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-blue-200">Year 1</span>
              <span className="text-xl font-bold">£180k ARR</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-200">Year 2</span>
              <span className="text-xl font-bold">£720k ARR</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-200">Year 3</span>
              <span className="text-xl font-bold">£2.1M ARR</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-200">Year 4</span>
              <span className="text-xl font-bold">£4.5M ARR</span>
            </div>
            <div className="flex justify-between items-center border-t border-white/20 pt-4">
              <span className="text-blue-200">Year 5</span>
              <span className="text-2xl font-bold">£8M ARR</span>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 10,
    title: "The Ask",
    subtitle: "Join Us in Transforming UK Trade",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-5xl font-bold text-white mb-6">The Ask</h2>
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 max-w-2xl mb-8">
          <p className="text-3xl font-bold text-white mb-2">£500,000 Seed Round</p>
          <p className="text-xl text-blue-200">18-month runway to £1M ARR</p>
        </div>
        <div className="grid grid-cols-3 gap-6 max-w-3xl mb-8">
          <div className="bg-white/10 rounded-xl p-6">
            <p className="text-3xl font-bold text-white mb-2">40%</p>
            <p className="text-blue-200">Sales & Marketing</p>
          </div>
          <div className="bg-white/10 rounded-xl p-6">
            <p className="text-3xl font-bold text-white mb-2">35%</p>
            <p className="text-blue-200">Product Development</p>
          </div>
          <div className="bg-white/10 rounded-xl p-6">
            <p className="text-3xl font-bold text-white mb-2">25%</p>
            <p className="text-blue-200">Operations</p>
          </div>
        </div>
        <div className="space-y-2 text-blue-100">
          <p className="text-lg">contact@truenorthtrade.com</p>
          <p className="text-lg">www.truenorthtrade.com</p>
        </div>
      </div>
    ),
    bgClass: "bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a]"
  }
];

export default function PitchInvestor() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <div className={`flex-1 ${slides[currentSlide].bgClass} transition-colors duration-300`}>
        <div className="h-full max-w-6xl mx-auto p-8">
          {slides[currentSlide].content}
        </div>
      </div>
      
      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="text-white hover:bg-gray-800"
          data-testid="btn-prev-slide"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentSlide ? "bg-white" : "bg-gray-600 hover:bg-gray-500"
              }`}
              data-testid={`dot-slide-${index}`}
            />
          ))}
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            {currentSlide + 1} / {slides.length}
          </span>
          <Button
            variant="ghost"
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="text-white hover:bg-gray-800"
            data-testid="btn-next-slide"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
