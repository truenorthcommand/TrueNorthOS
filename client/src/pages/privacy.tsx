import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Mail, Lock, Database, UserX, Download, Clock } from "lucide-react";
import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/home">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center border-b">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none p-6 md:p-8">
            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Database className="h-5 w-5" />
                1. Information We Collect
              </h2>
              <p className="text-muted-foreground mb-4">
                We collect information you provide directly to us when using TrueNorth Field View:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>Account Information:</strong> Name, email address, phone number, username, and password</li>
                <li><strong>Job Data:</strong> Customer details, job descriptions, materials used, photos, and signatures</li>
                <li><strong>Location Data:</strong> GPS coordinates when signing off jobs or updating your location</li>
                <li><strong>Communication Data:</strong> Messages sent through the internal messaging system</li>
                <li><strong>Usage Data:</strong> How you interact with our application</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5" />
                2. How We Use Your Information
              </h2>
              <p className="text-muted-foreground mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and complete job sheets and work orders</li>
                <li>Enable communication between team members</li>
                <li>Track engineer locations for job assignment and safety purposes</li>
                <li>Generate invoices and quotes for clients</li>
                <li>Send service-related notifications</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5" />
                3. Data Retention
              </h2>
              <p className="text-muted-foreground">
                We retain your personal data only for as long as necessary to fulfil the purposes for which it was collected, 
                including legal, accounting, or reporting requirements. Job records are retained for a minimum of 6 years 
                for compliance with UK business record-keeping requirements. You may request deletion of your account and 
                personal data at any time, subject to our legal retention obligations.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5" />
                4. Data Security
              </h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organisational measures to protect your personal data, including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure password hashing</li>
                <li>Two-factor authentication options</li>
                <li>Regular security assessments</li>
                <li>Access controls and audit logs</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Download className="h-5 w-5" />
                5. Your Rights (GDPR)
              </h2>
              <p className="text-muted-foreground mb-4">
                Under the General Data Protection Regulation (GDPR), you have the following rights:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>Right of Access:</strong> Request a copy of your personal data</li>
                <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
                <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
                <li><strong>Right to Restrict Processing:</strong> Request limitation of processing</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
                <li><strong>Right to Object:</strong> Object to processing of your personal data</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                To exercise these rights, please visit your Security settings or contact us using the details below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <UserX className="h-5 w-5" />
                6. Third-Party Services
              </h2>
              <p className="text-muted-foreground">
                We may use third-party services that collect, monitor, and analyse data to improve our service. 
                These include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
                <li>Google Maps API for location services and mapping</li>
                <li>OpenAI API for AI-powered technical assistance</li>
                <li>Cloud hosting providers for data storage</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                These third parties have their own privacy policies addressing how they use such information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5" />
                7. Contact Us
              </h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy or wish to exercise your data protection rights, 
                please contact our Data Protection Officer at:
              </p>
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg mt-4">
                <p className="text-muted-foreground">
                  <strong>Email:</strong> privacy@truenorthfieldview.com<br />
                  <strong>Address:</strong> TrueNorth Field View Ltd, Data Protection Officer<br />
                  United Kingdom
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review 
                this Privacy Policy periodically for any changes.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
