import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Printer, Download, Shield, Wrench } from "lucide-react";
import { Link } from "wouter";

const adminGuideContent = `
<h1>TrueNorth Field View - Admin User Guide</h1>

<h2>Getting Started</h2>

<h3>Logging In</h3>
<ol>
<li>Go to the application login page</li>
<li>Enter your username and password</li>
<li>Click "Sign In"</li>
</ol>

<p><strong>Default Admin Credentials (Demo):</strong></p>
<ul>
<li>Username: <code>admin</code></li>
<li>Password: <code>admin123</code></li>
</ul>

<hr/>

<h2>Dashboard Overview</h2>

<p>After logging in, you'll see the main navigation with access to:</p>
<ul>
<li><strong>Home</strong> - Welcome page with quick links</li>
<li><strong>Clients</strong> - Manage client companies and properties</li>
<li><strong>Jobs List</strong> - View and manage all job sheets</li>
<li><strong>Engineers</strong> - View engineer workloads and assignments</li>
<li><strong>Completed Jobs</strong> - Review signed-off jobs</li>
<li><strong>Staff Management</strong> - Add or remove staff members</li>
<li><strong>Calendar</strong> - View jobs in calendar format</li>
<li><strong>Live Map</strong> - Track engineer locations in real-time</li>
<li><strong>Technical Advisor</strong> - Expert technical assistance</li>
</ul>

<hr/>

<h2>Managing Clients</h2>

<h3>Adding a New Client</h3>
<ol>
<li>Go to <strong>Clients</strong> from the navigation menu</li>
<li>Click <strong>Add Client</strong></li>
<li>Fill in: Company Name, Contact Name, Phone Number, Email Address</li>
<li>Click <strong>Save</strong></li>
</ol>

<h3>Adding Properties to a Client</h3>
<ol>
<li>Select a client from the list</li>
<li>Click <strong>Add Property</strong></li>
<li>Enter the property address and postcode</li>
<li>Click <strong>Save</strong></li>
</ol>

<hr/>

<h2>Creating Jobs</h2>

<h3>Creating a New Job</h3>
<ol>
<li>Go to <strong>Jobs List</strong></li>
<li>Click <strong>Create Job</strong> or use the quick create from a client/property</li>
<li>Fill in the job details:
  <ul>
  <li><strong>Client/Service Provider</strong> - Your company name</li>
  <li><strong>Customer Name</strong> - The end customer</li>
  <li><strong>Address & Postcode</strong> - Job location</li>
  <li><strong>Site Contact</strong> - Name, phone, and email</li>
  <li><strong>Date</strong> - Scheduled date</li>
  <li><strong>Session</strong> - AM or PM</li>
  <li><strong>Job Order</strong> - Priority order for the day (optional)</li>
  <li><strong>Description of Works</strong> - What needs to be done</li>
  </ul>
</li>
<li>Assign engineer(s) to the job</li>
<li>Click <strong>Save</strong></li>
</ol>

<h3>Job Order (Priority)</h3>
<ul>
<li>Jobs are sorted by: Order Number → Session (AM before PM) → Creation time</li>
<li>Lower order numbers appear first</li>
<li>Leave blank to sort at the end</li>
</ul>

<hr/>

<h2>Assigning Engineers</h2>

<h3>Single Engineer Assignment</h3>
<ol>
<li>Open the job</li>
<li>Select an engineer from the dropdown</li>
<li>Save changes</li>
</ol>

<h3>Multiple Engineer Assignment</h3>
<ol>
<li>Open the job</li>
<li>Use the multi-select to choose multiple engineers</li>
<li>All selected engineers will see the job on their dashboard</li>
</ol>

<hr/>

<h2>Uploading Admin Reference Photos</h2>

<p>As an admin, you can upload reference photos to help engineers understand the job:</p>
<ol>
<li>Open the job details</li>
<li>Scroll to <strong>Photos</strong> section</li>
<li>Click <strong>Upload Admin Reference</strong></li>
<li>Select photos from your device</li>
<li>Photos will be labeled as "Admin" references</li>
</ol>

<hr/>

<h2>Monitoring Engineers</h2>

<h3>Live Map</h3>
<ol>
<li>Go to <strong>Live Map</strong> from the navigation</li>
<li>View all engineer locations on the map</li>
<li>Locations update in real-time when engineers have the app open</li>
</ol>

<h3>Engineer Dashboard</h3>
<ol>
<li>Go to <strong>Engineers</strong> from the navigation</li>
<li>See each engineer's current location status, number of assigned jobs, and jobs in progress</li>
</ol>

<hr/>

<h2>Reviewing Completed Jobs</h2>

<h3>Viewing Signed-Off Jobs</h3>
<ol>
<li>Go to <strong>Completed Jobs</strong></li>
<li>View all jobs that have been signed off</li>
<li>Click on a job to see: Works completed, Materials used, Evidence photos, Signatures, Sign-off location and timestamp</li>
</ol>

<h3>Printing Job Sheets</h3>
<ol>
<li>Open a completed job</li>
<li>Click <strong>Print</strong> or use your browser's print function</li>
<li>The job sheet will be formatted for printing</li>
</ol>

<hr/>

<h2>Staff Management</h2>

<h3>Adding New Staff</h3>
<ol>
<li>Go to <strong>Staff Management</strong></li>
<li>Click <strong>Add Staff</strong></li>
<li>Enter: Full Name, Username (for login), Password, Role (Admin or Engineer)</li>
<li>Click <strong>Create User</strong></li>
</ol>

<h3>Removing Staff</h3>
<ol>
<li>Go to <strong>Staff Management</strong></li>
<li>Find the staff member</li>
<li>Click the delete button</li>
<li>Confirm the deletion</li>
</ol>

<hr/>

<h2>Technical Advisor Settings</h2>

<h3>Managing Advisors</h3>
<ol>
<li>Go to <strong>Technical Advisor</strong> settings (in navigation)</li>
<li>You can: Create new advisors, Edit existing prompts, Enable/disable advisors, Delete advisors</li>
</ol>

<hr/>

<h2>Tips for Admins</h2>
<ul>
<li><strong>Check the Live Map regularly</strong> to monitor engineer locations</li>
<li><strong>Use job ordering</strong> to prioritise urgent jobs</li>
<li><strong>Review completed jobs</strong> to ensure quality and completeness</li>
<li><strong>Upload reference photos</strong> to help engineers understand complex jobs</li>
<li><strong>Keep client records updated</strong> for accurate job assignments</li>
</ul>
`;

const engineerGuideContent = `
<h1>TrueNorth Field View - Engineer User Guide</h1>

<h2>Getting Started</h2>

<h3>Logging In</h3>
<ol>
<li>Open the app on your phone or computer</li>
<li>Enter your username and password</li>
<li>Click "Sign In"</li>
</ol>

<p><strong>Demo Engineer Credentials:</strong></p>
<ul>
<li>Username: <code>john</code> / Password: <code>john123</code></li>
<li>Username: <code>sarah</code> / Password: <code>sarah123</code></li>
</ul>

<hr/>

<h2>Your Dashboard</h2>

<p>After logging in, you'll see your assigned jobs for the day, organised by:</p>
<ol>
<li>AM session jobs first</li>
<li>PM session jobs second</li>
<li>Priority order set by admin</li>
</ol>

<h3>Navigation Menu</h3>
<ul>
<li><strong>Home</strong> - Welcome page</li>
<li><strong>Jobs List</strong> - Your assigned jobs</li>
<li><strong>Technical Advisor</strong> - Get expert help with technical questions</li>
</ul>

<hr/>

<h2>Working on Jobs</h2>

<h3>Viewing Your Jobs</h3>
<ol>
<li>Go to <strong>Jobs List</strong></li>
<li>You'll see all jobs assigned to you</li>
<li>Jobs are sorted by date and priority</li>
<li>Tap on a job to view full details</li>
</ol>

<h3>Job Information (Read-Only)</h3>
<p>These fields are set by your admin and cannot be changed:</p>
<ul>
<li>Customer Name</li>
<li>Address and Postcode</li>
<li>Contact Details</li>
<li>Date and Session</li>
<li>Description of Works</li>
</ul>

<h3>Fields You Can Edit</h3>
<ul>
<li><strong>Works Completed</strong> - Describe what you've done</li>
<li><strong>Notes</strong> - Add any additional notes</li>
<li><strong>Materials</strong> - List materials used</li>
<li><strong>Photos</strong> - Upload evidence photos</li>
<li><strong>Signatures</strong> - Capture signatures</li>
<li><strong>Further Actions</strong> - Flag any issues</li>
</ul>

<hr/>

<h2>Completing Work</h2>

<h3>Recording Works Completed</h3>
<ol>
<li>Open the job</li>
<li>Find the <strong>Works Completed</strong> section</li>
<li>Describe the work you've done</li>
<li>Changes save automatically when you leave the field</li>
</ol>

<h3>Adding Materials Used</h3>
<ol>
<li>Open the job</li>
<li>Go to the <strong>Materials</strong> section</li>
<li>Click <strong>Add Material</strong></li>
<li>Enter: Material name, Quantity</li>
<li>Add more materials as needed</li>
</ol>

<hr/>

<h2>Taking Photos</h2>

<h3>Uploading Evidence Photos</h3>
<ol>
<li>Open the job</li>
<li>Scroll to <strong>Photos</strong> section</li>
<li>Click <strong>Upload Evidence</strong></li>
<li>Take a photo or select from your gallery</li>
<li>Photos are automatically uploaded and saved</li>
</ol>

<p><strong>Important:</strong> At least one evidence photo is required before sign-off.</p>

<h3>Viewing Admin Reference Photos</h3>
<ul>
<li>Reference photos uploaded by admin appear with an "Admin" label</li>
<li>These show you what needs to be done or what to look for</li>
</ul>

<hr/>

<h2>Capturing Signatures</h2>

<h3>Engineer Signature</h3>
<ol>
<li>Open the job</li>
<li>Go to <strong>Signatures</strong> section</li>
<li>Click on <strong>Engineer Signature</strong></li>
<li>Sign using your finger or stylus</li>
<li>Click <strong>Save Signature</strong></li>
</ol>

<h3>Customer Signature</h3>
<ol>
<li>Open the job</li>
<li>Go to <strong>Signatures</strong> section</li>
<li>Hand the device to the customer</li>
<li>Ask them to sign in the <strong>Customer Signature</strong> box</li>
<li>Click <strong>Save Signature</strong></li>
</ol>

<hr/>

<h2>Signing Off a Job</h2>

<h3>Requirements Before Sign-Off</h3>
<p>Before you can sign off a job, you must have:</p>
<ol>
<li>At least one evidence photo uploaded</li>
<li>Your engineer signature captured</li>
<li>Customer signature captured</li>
<li>Location services enabled (for GPS verification)</li>
</ol>

<h3>How to Sign Off</h3>
<ol>
<li>Complete all required items above</li>
<li>Click <strong>Sign Off Job</strong></li>
<li>Allow location access if prompted</li>
<li>The job will be marked as complete with: Your current GPS location, Timestamp, Full address</li>
</ol>

<hr/>

<h2>Flagging Issues</h2>

<h3>Adding Further Actions</h3>
<p>If you find problems that need follow-up:</p>
<ol>
<li>Open the job</li>
<li>Go to <strong>Further Actions</strong> section</li>
<li>Click <strong>Add Action</strong></li>
<li>Enter: Description of the issue, Priority level (Low, Medium, High, Urgent)</li>
<li>Save the action</li>
<li>Admin will be notified of flagged issues</li>
</ol>

<hr/>

<h2>Using Technical Advisor</h2>

<p>Get expert help with technical questions:</p>

<h3>Starting a Chat</h3>
<ol>
<li>Go to <strong>Technical Advisor</strong> from the menu</li>
<li>Choose an advisor based on your question:
  <ul>
  <li><strong>Snagging Pro</strong> - Quality defects and snagging</li>
  <li><strong>Trade Parts Finder</strong> - Finding UK parts</li>
  <li><strong>Gas & Heating</strong> - Boiler and gas issues</li>
  <li><strong>Electrical Expert</strong> - Wiring and electrical problems</li>
  </ul>
</li>
<li>Type your question</li>
<li>Get instant expert advice</li>
</ol>

<h3>Sending Photos for Analysis</h3>
<ol>
<li>In the chat, click the camera/image icon</li>
<li>Take a photo or select one</li>
<li>Add your question</li>
<li>The advisor will analyse the image and respond</li>
</ol>

<hr/>

<h2>Location Tracking</h2>

<h3>Why Location is Needed</h3>
<ul>
<li>Your location is tracked to verify you're at job sites</li>
<li>Sign-off requires GPS location as proof of attendance</li>
<li>Admin can see your location on the live map</li>
</ul>

<h3>Enabling Location</h3>
<ol>
<li>When prompted, allow location access</li>
<li>Keep location services on while working</li>
<li>Your position updates automatically</li>
</ol>

<hr/>

<h2>Tips for Engineers</h2>
<ul>
<li><strong>Check your jobs each morning</strong> - Review AM/PM sessions</li>
<li><strong>Take photos as you work</strong> - Document before, during, and after</li>
<li><strong>Get signatures before leaving</strong> - Don't forget customer sign-off</li>
<li><strong>Use the Technical Advisor</strong> - Get help with tricky problems</li>
<li><strong>Flag issues immediately</strong> - Use Further Actions for problems</li>
<li><strong>Keep your app open</strong> - Allows location tracking for admin</li>
</ul>

<hr/>

<h2>Troubleshooting</h2>

<h3>Can't Sign Off a Job?</h3>
<p>Check that you have:</p>
<ul>
<li>Uploaded at least one evidence photo</li>
<li>Captured your signature</li>
<li>Captured customer signature</li>
<li>Enabled location services</li>
</ul>

<h3>Location Not Working?</h3>
<ol>
<li>Check your device's location settings</li>
<li>Ensure the browser has location permission</li>
<li>Try refreshing the page</li>
<li>Move to an area with better GPS signal</li>
</ol>

<h3>App Running Slowly?</h3>
<ol>
<li>Close other apps on your device</li>
<li>Clear your browser cache</li>
<li>Ensure you have a good internet connection</li>
</ol>
`;

export default function UserGuides() {
  const [activeTab, setActiveTab] = useState("admin");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 no-print">
          <Link href="/home">
            <Button variant="ghost" data-testid="link-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Button onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print Guide
          </Button>
        </div>

        <div className="no-print">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="admin" className="flex items-center gap-2" data-testid="tab-admin">
                <Shield className="h-4 w-4" />
                Admin Guide
              </TabsTrigger>
              <TabsTrigger value="engineer" className="flex items-center gap-2" data-testid="tab-engineer">
                <Wrench className="h-4 w-4" />
                Engineer Guide
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Administrator User Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-slate max-w-none guide-content"
                    dangerouslySetInnerHTML={{ __html: adminGuideContent }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="engineer">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Engineer User Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-slate max-w-none guide-content"
                    dangerouslySetInnerHTML={{ __html: engineerGuideContent }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Print-only content */}
        <div className="hidden print:block">
          {activeTab === "admin" ? (
            <div 
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: adminGuideContent }}
            />
          ) : (
            <div 
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: engineerGuideContent }}
            />
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
        .guide-content h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          color: #1e293b;
        }
        .guide-content h2 {
          font-size: 1.35rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #334155;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 0.5rem;
        }
        .guide-content h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #475569;
        }
        .guide-content p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
        }
        .guide-content ul, .guide-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .guide-content li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }
        .guide-content code {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.9em;
        }
        .guide-content hr {
          margin: 2rem 0;
          border-color: #e2e8f0;
        }
        .guide-content strong {
          color: #1e293b;
        }
      `}</style>
    </div>
  );
}
