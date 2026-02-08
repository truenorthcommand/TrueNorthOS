import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Scale, AlertTriangle, Ban, Shield, Globe } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";

export default function Terms() {
  return (
    <PublicLayout>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container max-w-4xl mx-auto px-4 py-8">

        <Card>
          <CardHeader className="text-center border-b">
            <div className="flex justify-center mb-4">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none p-6 md:p-8">
            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5" />
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground">
                By accessing and using TrueNorth Field View ("the Service"), you accept and agree to be bound by these 
                Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Service. 
                These Terms apply to all users, including administrators, engineers, and any other personnel 
                granted access to the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5" />
                2. Description of Service
              </h2>
              <p className="text-muted-foreground">
                TrueNorth Field View is a web-based job management platform designed for field service companies. 
                The Service enables users to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Create and manage job sheets and work orders</li>
                <li>Track engineer locations and job progress</li>
                <li>Capture photos, signatures, and completion evidence</li>
                <li>Generate quotes and invoices</li>
                <li>Communicate with team members</li>
                <li>Access AI-powered technical assistance</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5" />
                3. User Accounts
              </h2>
              <p className="text-muted-foreground mb-4">
                To access the Service, you must be provided with user credentials by your organisation's administrator. 
                You are responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Maintaining the confidentiality of your login credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying your administrator immediately of any unauthorised use</li>
                <li>Ensuring your contact information is accurate and up-to-date</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Ban className="h-5 w-5" />
                4. Acceptable Use
              </h2>
              <p className="text-muted-foreground mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Upload malicious software or harmful content</li>
                <li>Attempt to gain unauthorised access to the Service or related systems</li>
                <li>Interfere with or disrupt the Service's operation</li>
                <li>Share your account credentials with others</li>
                <li>Use the Service for purposes other than legitimate business activities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Scale className="h-5 w-5" />
                5. Intellectual Property
              </h2>
              <p className="text-muted-foreground">
                The Service and its original content, features, and functionality are owned by TrueNorth Field View 
                and are protected by international copyright, trademark, patent, trade secret, and other intellectual 
                property laws. You retain ownership of any data you input into the Service, but grant us a licence 
                to use this data solely for the purpose of providing the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5" />
                6. Limitation of Liability
              </h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, TrueNorth Field View shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages, including but not limited to loss of profits, 
                data, or business opportunities, arising out of or in connection with your use of the Service. 
                Our total liability shall not exceed the amount paid by your organisation for the Service in the 
                12 months preceding the claim.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Data Processing</h2>
              <p className="text-muted-foreground">
                By using the Service, you acknowledge that personal data will be processed in accordance with our 
                <Link href="/privacy" className="text-primary underline mx-1">Privacy Policy</Link>. 
                If you are an administrator, you are responsible for ensuring that all users within your organisation 
                are informed about and consent to the data processing activities carried out through the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Service Availability</h2>
              <p className="text-muted-foreground">
                We strive to maintain high availability of the Service but do not guarantee uninterrupted access. 
                The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond 
                our control. We will endeavour to provide notice of planned maintenance where possible.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate your access to the Service at any time, with or without 
                cause, and with or without notice. Upon termination, your right to use the Service will immediately 
                cease. Your organisation may request export of their data within 30 days of termination.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of England and Wales, 
                without regard to its conflict of law provisions. Any disputes arising under these Terms shall be 
                subject to the exclusive jurisdiction of the courts of England and Wales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">11. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes 
                by posting the new Terms on this page and updating the "Last updated" date. Your continued use of 
                the Service after such modifications constitutes your acceptance of the updated Terms.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
    </PublicLayout>
  );
}
