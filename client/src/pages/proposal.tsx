import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  CheckCircle, 
  Briefcase, 
  Calculator, 
  Truck, 
  Users, 
  Shield, 
  Brain,
  Star
} from "lucide-react";

export default function Proposal() {
  const handlePrint = () => {
    window.print();
  };

  const today = new Date();
  const validUntil = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Print Button - Hidden when printing */}
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <Button onClick={handlePrint} size="lg" className="shadow-lg">
          <Download className="mr-2 h-5 w-5" />
          Download PDF
        </Button>
      </div>

      {/* Proposal Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-0">
        
        {/* Header */}
        <div className="text-center mb-12 pb-8 border-b-4 border-primary">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Commercial Proposal</h1>
          <h2 className="text-2xl text-primary font-semibold mb-4">Pro Main Solutions</h2>
          <p className="text-lg text-slate-600">Field Service ERP Platform</p>
          <p className="text-sm text-slate-500 mt-4">Powered By TrueNorth Operations Group</p>
        </div>

        {/* Document Info */}
        <div className="grid grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Prepared For:</h3>
            <p className="text-slate-600">[Client Name]</p>
            <p className="text-slate-600">[Client Company]</p>
            <p className="text-slate-600">[Client Address]</p>
          </div>
          <div className="text-right">
            <h3 className="font-semibold text-slate-700 mb-2">Document Details:</h3>
            <p className="text-slate-600">Date: {formatDate(today)}</p>
            <p className="text-slate-600">Valid Until: {formatDate(validUntil)}</p>
            <p className="text-slate-600">Reference: PMS-{today.getFullYear()}-001</p>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" />
            Executive Summary
          </h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-slate-700 leading-relaxed mb-4">
                Pro Main Solutions is a comprehensive Field Service ERP platform designed specifically for UK field service 
                companies. Built to replace fragmented tools and manual processes, this all-in-one solution enables your 
                team to manage jobs, quotes, invoices, timesheets, fleet, and workforce from a single integrated platform.
              </p>
              <p className="text-slate-700 leading-relaxed">
                With built-in AI-powered automation, UK compliance features (HMRC, VAT, Gas Safe, BS 7671), and real-time 
                GPS tracking, Pro Main Solutions positions your business at the forefront of field service technology 
                while reducing administrative overhead by up to 40%.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Platform Modules */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Platform Modules</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  Operations
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Job management & scheduling</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Quoting with UK VAT (0/5/20%)</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Invoice generation</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Client CRM & portal</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Digital signatures</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-green-600" />
                  Finance
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Timesheets with clock in/out</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Expense tracking & receipts</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> HMRC mileage calculator</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Payment collection</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Approval workflows</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-orange-600" />
                  Fleet
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Vehicle registry</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Daily walkaround checks</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Defect reporting & tracking</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Compliance records</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Vehicle status tracking</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                  Workforce
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Team messaging</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Live GPS tracking</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Multi-role system</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Skills management</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Weekly planner</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-red-600" />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Two-Factor Authentication</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> GDPR compliance tools</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Geo-verified sign-offs</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Full audit trails</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Site inspections</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-indigo-600" />
                  AI Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Smart job scheduling</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Document scanner (OCR)</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Report generation</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Trade-specific advisors</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Voice notes & transcription</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Page Break for Print */}
        <div className="print:break-before-page" />

        {/* Competitive Advantage */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Competitive Advantage</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-semibold">Feature Area</th>
                      <th className="text-center py-2 font-semibold text-primary">Pro Main Solutions</th>
                      <th className="text-center py-2 font-semibold">ServiceTitan</th>
                      <th className="text-center py-2 font-semibold">Simpro</th>
                      <th className="text-center py-2 font-semibold">Jobber</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">AI / Intelligence</td>
                      <td className="text-center text-primary font-bold">5/5</td>
                      <td className="text-center">3/5</td>
                      <td className="text-center">2/5</td>
                      <td className="text-center">2/5</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">UK Compliance</td>
                      <td className="text-center text-primary font-bold">5/5</td>
                      <td className="text-center">2/5</td>
                      <td className="text-center">3/5</td>
                      <td className="text-center">3/5</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">Fleet Management</td>
                      <td className="text-center text-primary font-bold">4/5</td>
                      <td className="text-center">3/5</td>
                      <td className="text-center">4/5</td>
                      <td className="text-center">2/5</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">Operations</td>
                      <td className="text-center text-primary font-bold">4/5</td>
                      <td className="text-center">5/5</td>
                      <td className="text-center">4/5</td>
                      <td className="text-center">3/5</td>
                    </tr>
                    <tr>
                      <td className="py-2">Pricing Value</td>
                      <td className="text-center text-primary font-bold">4/5</td>
                      <td className="text-center">2/5</td>
                      <td className="text-center">3/5</td>
                      <td className="text-center">4/5</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Pricing Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Investment Summary</h2>
          
          {/* Build Cost */}
          <Card className="mb-6 border-2 border-primary">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-xl">Initial Platform Build</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg">Custom Platform Development</span>
                <span className="text-2xl font-bold">£200,000 - £260,000</span>
              </div>
              <Separator className="my-4" />
              <p className="text-sm text-slate-600 mb-4">Includes:</p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Full 6-module platform development</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> AI integration and configuration</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Mapping and GPS services setup</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> White-label branding</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> User training and documentation</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> 90-day post-launch support</li>
              </ul>
              <Separator className="my-4" />
              <p className="text-sm text-slate-600">
                <strong>Payment Terms:</strong> 30% on project start, 40% at milestone completion, 30% on go-live
              </p>
            </CardContent>
          </Card>

          {/* Monthly Subscription */}
          <Card className="border-2 border-primary">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-xl">Monthly Subscription</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Growth</p>
                  <p className="text-2xl font-bold">£3,000</p>
                  <p className="text-sm text-slate-600">/month base</p>
                  <p className="text-sm text-primary font-semibold mt-2">+ £70/user</p>
                </div>
                <div className="text-center p-4 border-2 border-primary rounded-lg bg-primary/5">
                  <p className="text-sm text-primary font-semibold mb-1">Scale (Recommended)</p>
                  <p className="text-2xl font-bold">£5,000</p>
                  <p className="text-sm text-slate-600">/month base</p>
                  <p className="text-sm text-primary font-semibold mt-2">+ £60/user</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Enterprise</p>
                  <p className="text-2xl font-bold">£7,500</p>
                  <p className="text-sm text-slate-600">/month base</p>
                  <p className="text-sm text-primary font-semibold mt-2">+ £50/user</p>
                </div>
              </div>

              <Separator className="my-4" />

              <h4 className="font-semibold mb-3">Example Pricing (Scale Tier)</h4>
              <table className="w-full text-sm mb-4">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">Platform Base Fee</td>
                    <td className="py-2 text-right">£5,000</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">10 x Field Engineer Seats (@ £60)</td>
                    <td className="py-2 text-right">£600</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">3 x Office/Admin Seats (@ £30)</td>
                    <td className="py-2 text-right">£90</td>
                  </tr>
                  <tr className="font-bold">
                    <td className="py-2">Monthly Total</td>
                    <td className="py-2 text-right text-primary">£5,690</td>
                  </tr>
                </tbody>
              </table>

              <Separator className="my-4" />

              <p className="text-sm text-slate-600 mb-2"><strong>All tiers include:</strong></p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Secure cloud hosting and daily backups</li>
                <li>• Technical support (response within 4 hours)</li>
                <li>• Platform updates and security patches</li>
                <li>• AI usage allowance (reports, scans, suggestions)</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Terms */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Terms & Conditions</h2>
          <Card>
            <CardContent className="pt-6 text-sm text-slate-600 space-y-3">
              <p>1. This proposal is valid for 30 days from the date of issue.</p>
              <p>2. Prices are quoted in GBP and exclusive of VAT (20%).</p>
              <p>3. Monthly subscription is billed annually in advance with 10% discount, or monthly with no commitment after initial 12-month term.</p>
              <p>4. Additional users can be added at any time at the per-user rate.</p>
              <p>5. Custom integrations and development work quoted separately.</p>
              <p>6. 99.9% uptime SLA included with Scale and Enterprise tiers.</p>
            </CardContent>
          </Card>
        </section>

        {/* Signature Block */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Acceptance</h2>
          <div className="grid grid-cols-2 gap-8">
            <Card>
              <CardContent className="pt-6">
                <p className="font-semibold mb-4">For TrueNorth Operations Group:</p>
                <div className="border-b border-slate-300 h-16 mb-2"></div>
                <p className="text-sm text-slate-600">Signature</p>
                <div className="mt-4">
                  <p className="text-sm">Name: _________________________</p>
                  <p className="text-sm mt-2">Date: _________________________</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="font-semibold mb-4">For Client:</p>
                <div className="border-b border-slate-300 h-16 mb-2"></div>
                <p className="text-sm text-slate-600">Signature</p>
                <div className="mt-4">
                  <p className="text-sm">Name: _________________________</p>
                  <p className="text-sm mt-2">Date: _________________________</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 border-t pt-8">
          <p className="font-semibold">TrueNorth Operations Group</p>
          <p>Professional Field Service Solutions</p>
          <p className="mt-2">www.truenorth.ops | contact@truenorth.ops</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:break-before-page {
            break-before: page;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}
