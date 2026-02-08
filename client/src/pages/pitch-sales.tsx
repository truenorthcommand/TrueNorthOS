import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Wrench, Truck, FileText, Calculator, Users, Zap, Shield, Globe, CheckCircle, ArrowRight, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const slides = [
  {
    id: 1,
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
          <span className="text-5xl font-bold text-[#0F2B4C]">TN</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4">TrueNorth Trade OS</h1>
        <p className="text-2xl text-blue-100 mb-6">Stop Drowning in Paperwork. Start Growing Your Business.</p>
        <p className="text-lg text-blue-200 max-w-2xl">The all-in-one platform that replaces your job sheets, fleet tracking, invoicing, and 5 other systems — with AI that actually helps your engineers.</p>
      </div>
    ),
    bgClass: "bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a]"
  },
  {
    id: 2,
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-[#0F2B4C] mb-2 text-center">Sound Familiar?</h2>
        <p className="text-xl text-gray-600 mb-8 text-center">The daily struggles of running a trade business</p>
        <div className="grid grid-cols-2 gap-6 flex-1">
          <div className="bg-red-50 rounded-xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-800">Paperwork Mountain</h3>
              <p className="text-red-700 mt-1">"I spend half my evenings typing up job sheets and chasing timesheets. There must be a better way."</p>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Calculator className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-800">Where's My Money?</h3>
              <p className="text-red-700 mt-1">"Invoices get lost. Customers forget to pay. I'm basically running a bank for free."</p>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Truck className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-800">Fleet Chaos</h3>
              <p className="text-red-700 mt-1">"Van broke down - no one did the walkaround checks. Now I'm facing a fine AND a repair bill."</p>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-800">Where Are My Engineers?</h3>
              <p className="text-red-700 mt-1">"Customer calls asking 'when will they arrive?' I have to ring round to find out."</p>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-800">Compliance Nightmares</h3>
              <p className="text-red-700 mt-1">"Gas Safe audit coming up and I can't find half the certificates. It's keeping me up at night."</p>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-800">No Time to Grow</h3>
              <p className="text-red-700 mt-1">"I wanted to build a business, but I've become the admin person. When do I actually grow?"</p>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 3,
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-white mb-2 text-center">What If Everything Just Worked?</h2>
        <p className="text-xl text-blue-100 mb-8 text-center">One app. Your whole business. Finally sorted.</p>
        <div className="grid grid-cols-4 gap-4 flex-1">
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <Wrench className="w-10 h-10 text-blue-300 mb-3" />
            <h3 className="font-bold text-white mb-2">Jobs & Quotes</h3>
            <p className="text-sm text-blue-100 flex-1">Create quotes in seconds. Convert to jobs with one tap. Engineers see everything on their phone.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <Calculator className="w-10 h-10 text-green-300 mb-3" />
            <h3 className="font-bold text-white mb-2">Finance</h3>
            <p className="text-sm text-blue-100 flex-1">Invoices that chase themselves. Timesheets that submit themselves. Expenses with photo receipts.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <Truck className="w-10 h-10 text-orange-300 mb-3" />
            <h3 className="font-bold text-white mb-2">Fleet</h3>
            <p className="text-sm text-blue-100 flex-1">Digital walkaround checks. Defect tracking. Live vehicle locations. Stay audit-ready.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <Users className="w-10 h-10 text-purple-300 mb-3" />
            <h3 className="font-bold text-white mb-2">Team</h3>
            <p className="text-sm text-blue-100 flex-1">See everyone on the map. WhatsApp-style messaging. Track certifications and skills.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <Shield className="w-10 h-10 text-teal-300 mb-3" />
            <h3 className="font-bold text-white mb-2">Quality</h3>
            <p className="text-sm text-blue-100 flex-1">Photo evidence. Customer signatures. Snagging sheets. Works manager approvals.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <FileText className="w-10 h-10 text-yellow-300 mb-3" />
            <h3 className="font-bold text-white mb-2">Compliance</h3>
            <p className="text-sm text-blue-100 flex-1">Gas Safe, BS 7671, HMRC mileage rates. All built in. All automatic.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <Globe className="w-10 h-10 text-indigo-300 mb-3" />
            <h3 className="font-bold text-white mb-2">AI Assistant</h3>
            <p className="text-sm text-blue-100 flex-1">Ask anything. Find suppliers. Check regulations. Get instant answers on-site.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 flex flex-col">
            <Zap className="w-10 h-10 text-pink-300 mb-3" />
            <h3 className="font-bold text-white mb-2">AI Learning</h3>
            <p className="text-sm text-blue-100 flex-1">Gets smarter every day. Learns your pricing. Suggests the right materials. Remembers everything.</p>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a]"
  },
  {
    id: 4,
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-[#0F2B4C] mb-2 text-center">AI That Actually Helps</h2>
        <p className="text-xl text-gray-600 mb-8 text-center">Not a gimmick. Real time savings every single day.</p>
        <div className="grid grid-cols-2 gap-8 flex-1">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#0F2B4C]">Web Search</h3>
                <p className="text-gray-600">Find anything instantly</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Your engineer asks:</p>
                <p className="font-medium">"Where can I get a Vaillant ecoTEC plus 832 cheapest?"</p>
              </div>
              <ArrowRight className="w-6 h-6 text-blue-600 mx-auto" />
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">AI responds with:</p>
                <p className="font-medium">Price comparison from 5 merchants, links to buy, stock levels</p>
              </div>
              <p className="text-center text-blue-600 font-semibold">30 minutes research → 30 seconds</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#0F2B4C]">Business Learning</h3>
                <p className="text-gray-600">Knows your business inside out</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">You ask:</p>
                <p className="font-medium">"What did we charge for a combi swap last month?"</p>
              </div>
              <ArrowRight className="w-6 h-6 text-green-600 mx-auto" />
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">AI knows:</p>
                <p className="font-medium">Average: £2,450. Materials: £1,200. Labour: 8 hours. Last 3 jobs listed.</p>
              </div>
              <p className="text-center text-green-600 font-semibold">Accurate quotes. Every time.</p>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 5,
    content: (
      <div className="h-full flex flex-col">
        <h2 className="text-4xl font-bold text-[#0F2B4C] mb-2 text-center">The Numbers Don't Lie</h2>
        <p className="text-xl text-gray-600 mb-6 text-center">What TrueNorth saves a 31-person company every year</p>
        <div className="grid grid-cols-3 gap-6 flex-1">
          <div className="bg-blue-50 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">Time Saved Per Week</h3>
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Job scheduling</span>
                <span className="font-bold text-blue-600">7 hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Quote creation</span>
                <span className="font-bold text-blue-600">6 hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">AI research (vs manual)</span>
                <span className="font-bold text-blue-600">9 hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Fleet paperwork</span>
                <span className="font-bold text-blue-600">8 hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Invoicing & chasing</span>
                <span className="font-bold text-blue-600">5 hrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Timesheets & expenses</span>
                <span className="font-bold text-blue-600">8 hrs</span>
              </div>
            </div>
            <div className="border-t-2 border-blue-200 pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-blue-800">TOTAL WEEKLY</span>
                <span className="text-2xl font-bold text-blue-600">55 hrs</span>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-green-800 mb-4">Money Saved Per Year</h3>
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Admin time</span>
                <span className="font-bold text-green-600">£31,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Engineer productivity</span>
                <span className="font-bold text-green-600">£52,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Software consolidation</span>
                <span className="font-bold text-green-600">£8,400</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Fuel savings</span>
                <span className="font-bold text-green-600">£7,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Reduced errors</span>
                <span className="font-bold text-green-600">£12,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Faster payments</span>
                <span className="font-bold text-green-600">£18,000</span>
              </div>
            </div>
            <div className="border-t-2 border-green-200 pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-green-800">TOTAL ANNUAL</span>
                <span className="text-2xl font-bold text-green-600">£131,200</span>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a] rounded-2xl p-6 flex flex-col text-white">
            <h3 className="text-lg font-semibold text-blue-200 mb-4">Your Return on Investment (Year 1)</h3>
            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="text-center p-4 bg-white/10 rounded-xl">
                <p className="text-blue-200 mb-1">Year 1 Cost</p>
                <p className="text-3xl font-bold">£40,328</p>
              </div>
              <div className="text-center p-4 bg-white/10 rounded-xl">
                <p className="text-blue-200 mb-1">Annual Savings</p>
                <p className="text-3xl font-bold">£131,200</p>
              </div>
              <div className="text-center p-4 bg-green-500/30 rounded-xl border border-green-400/50">
                <p className="text-green-200 mb-1">Net Benefit</p>
                <p className="text-4xl font-bold">£90,872</p>
              </div>
            </div>
            <div className="text-center mt-4">
              <p className="text-blue-200">Pays for itself in</p>
              <p className="text-3xl font-bold">3.7 months</p>
            </div>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 6,
    content: (
      <div className="grid grid-cols-2 gap-8 h-full items-center">
        <div>
          <h2 className="text-4xl font-bold text-[#0F2B4C] mb-6">Simple Pricing, Big Value</h2>
          <p className="text-xl text-gray-600 mb-8">Everything you need, priced fairly. No surprises.</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>All 8 modules included</span>
            </div>
            <div className="flex items-center gap-3 text-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>Unlimited jobs, quotes, invoices</span>
            </div>
            <div className="flex items-center gap-3 text-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>AI assistant for every user</span>
            </div>
            <div className="flex items-center gap-3 text-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>Mobile app (works offline)</span>
            </div>
            <div className="flex items-center gap-3 text-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>UK compliance built-in</span>
            </div>
            <div className="flex items-center gap-3 text-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span>Free training & setup included</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-xl p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold">Starter</h3>
              <div className="text-right">
                <span className="text-3xl font-bold">£39</span>
                <span className="text-gray-500">/user/mo</span>
              </div>
            </div>
            <p className="text-gray-600">For solo traders and micro-businesses</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold">Professional</h3>
              <div className="text-right">
                <span className="text-3xl font-bold text-blue-600">£69</span>
                <span className="text-gray-500">/user/mo</span>
              </div>
            </div>
            <p className="text-gray-600">For growing teams (3-10 users). Adds GPS, AI web search.</p>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border-2 border-green-500 relative">
            <div className="absolute -top-3 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold">Business</h3>
              <div className="text-right">
                <span className="text-3xl font-bold text-green-600">£99</span>
                <span className="text-gray-500">/user/mo</span>
              </div>
            </div>
            <p className="text-gray-600">Full platform with fleet, AI learning, and memory.</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold">Enterprise</h3>
              <div className="text-right">
                <span className="text-3xl font-bold text-purple-600">£149</span>
                <span className="text-gray-500">/user/mo</span>
              </div>
            </div>
            <p className="text-gray-600">White-label, custom integrations, dedicated support.</p>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-white"
  },
  {
    id: 7,
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-5xl font-bold text-white mb-6">Ready to Transform Your Business?</h2>
        <p className="text-2xl text-blue-100 mb-12 max-w-2xl">Join the trade companies saving 55+ hours every week and £94,000+ every year.</p>
        
        <div className="grid grid-cols-3 gap-8 max-w-4xl mb-12">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">1</span>
            </div>
            <h3 className="font-bold text-white mb-2">Book a Demo</h3>
            <p className="text-blue-200 text-sm">30 mins. See exactly how it works for your business.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">2</span>
            </div>
            <h3 className="font-bold text-white mb-2">Free Trial</h3>
            <p className="text-blue-200 text-sm">14 days to try it with your team. No commitment.</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">3</span>
            </div>
            <h3 className="font-bold text-white mb-2">Go Live</h3>
            <p className="text-blue-200 text-sm">Full training included. We handle the setup.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-white">
            <Mail className="w-5 h-5" />
            <span className="text-lg">info@truenorthoperationsgroup.com</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <MapPin className="w-5 h-5" />
            <span className="text-sm">Unit 2 Meadow View Industrial Estate, Ashford, Kent, TN26 2NR</span>
          </div>
        </div>
      </div>
    ),
    bgClass: "bg-gradient-to-br from-[#0F2B4C] to-[#1a4a7a]"
  }
];

export default function PitchSales() {
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
