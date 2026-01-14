import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, XCircle, Phone, Mail, FileCheck, MapPin, Calendar, Printer, AlertTriangle, CheckCircle2, Clock, Building2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";

type CertificateType = {
  id: string;
  name: string;
  shortCode: string;
  category: string;
};

type Certificate = {
  id: string;
  certificateNo: string;
  certificateTypeId: string;
  propertyAddress: string;
  propertyPostcode: string | null;
  issueDate: string;
  expiryDate: string | null;
  status: string;
  result: string | null;
  engineerName: string | null;
  certificateType: CertificateType | null;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
};

type CompanySettings = {
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
};

type PortalData = {
  client: Client;
  certificates: Certificate[];
  companySettings: CompanySettings | null;
};

const getStatusBadge = (status: string, expiryDate: string | null) => {
  const expiry = expiryDate ? new Date(expiryDate) : null;
  const today = new Date();
  const daysUntilExpiry = expiry ? differenceInDays(expiry, today) : null;

  if (status === "expired" || (daysUntilExpiry !== null && daysUntilExpiry < 0)) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-status-expired">
        <XCircle className="w-3 h-3" />
        Expired
      </Badge>
    );
  }
  if (status === "expiring_soon" || (daysUntilExpiry !== null && daysUntilExpiry <= 30)) {
    return (
      <Badge className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1" data-testid="badge-status-expiring">
        <AlertTriangle className="w-3 h-3" />
        Expiring Soon
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1" data-testid="badge-status-valid">
      <CheckCircle2 className="w-3 h-3" />
      Valid
    </Badge>
  );
};

const getResultBadge = (result: string | null) => {
  switch (result) {
    case "satisfactory":
      return <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-result-satisfactory">Satisfactory</Badge>;
    case "unsatisfactory":
      return <Badge variant="destructive" data-testid="badge-result-unsatisfactory">Unsatisfactory</Badge>;
    case "improvements_required":
      return <Badge className="bg-amber-500 hover:bg-amber-600" data-testid="badge-result-improvements">Improvements Required</Badge>;
    default:
      return null;
  }
};

export default function ClientCertificates() {
  const [location] = useLocation();
  const [data, setData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    fetchCertificates();
  }, [location]);

  const fetchCertificates = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");
      const email = urlParams.get("email");

      if (!token) {
        setError("Invalid access link. Please request a new link from your service provider.");
        setIsLoading(false);
        return;
      }

      const queryParams = new URLSearchParams();
      queryParams.set("token", token);
      if (email) queryParams.set("email", email);

      const res = await fetch(`/api/client-portal/certificates?${queryParams.toString()}`);
      if (res.ok) {
        const responseData = await res.json();
        setData(responseData);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Unable to access certificates. Please contact your service provider.");
      }
    } catch (err) {
      setError("Failed to load certificates. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewCert = (cert: Certificate) => {
    setSelectedCert(cert);
    setViewOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" data-testid="loading-state">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your certificates...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" data-testid="error-state">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Access Certificates</h2>
            <p className="text-muted-foreground">{error || "Access link is invalid or expired"}</p>
            <p className="text-sm text-muted-foreground mt-4">
              If you believe this is an error, please contact your service provider for a new access link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { client, certificates, companySettings } = data;

  const validCerts = certificates.filter(c => {
    const expiry = c.expiryDate ? new Date(c.expiryDate) : null;
    return !expiry || differenceInDays(expiry, new Date()) >= 0;
  });

  const expiringCerts = certificates.filter(c => {
    const expiry = c.expiryDate ? new Date(c.expiryDate) : null;
    const days = expiry ? differenceInDays(expiry, new Date()) : null;
    return days !== null && days >= 0 && days <= 30;
  });

  const expiredCerts = certificates.filter(c => {
    const expiry = c.expiryDate ? new Date(c.expiryDate) : null;
    return expiry && differenceInDays(expiry, new Date()) < 0;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4" data-testid="client-certificates-page">
      <div className="max-w-4xl mx-auto space-y-6">
        {companySettings?.companyName && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary" data-testid="company-name">{companySettings.companyName}</h1>
            {companySettings.companyAddress && <p className="text-muted-foreground">{companySettings.companyAddress}</p>}
            <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {companySettings.companyPhone && (
                <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{companySettings.companyPhone}</span>
              )}
              {companySettings.companyEmail && (
                <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{companySettings.companyEmail}</span>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2" data-testid="portal-title">
                  <FileCheck className="w-6 h-6" />
                  Property Certificates
                </CardTitle>
                <p className="text-muted-foreground mt-1" data-testid="client-name">
                  Certificates for {client.name}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <Badge variant="outline" className="bg-green-50">
                  {validCerts.length} Valid
                </Badge>
                {expiringCerts.length > 0 && (
                  <Badge variant="outline" className="bg-yellow-50">
                    {expiringCerts.length} Expiring Soon
                  </Badge>
                )}
                {expiredCerts.length > 0 && (
                  <Badge variant="outline" className="bg-red-50">
                    {expiredCerts.length} Expired
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {certificates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="no-certificates">
                <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No certificates found for your properties.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {certificates.map((cert) => (
                  <Card key={cert.id} className="border" data-testid={`certificate-card-${cert.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-lg" data-testid={`cert-type-${cert.id}`}>
                                {cert.certificateType?.name || "Certificate"}
                              </h3>
                              <p className="text-sm text-muted-foreground font-mono" data-testid={`cert-no-${cert.id}`}>
                                {cert.certificateNo}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {getStatusBadge(cert.status, cert.expiryDate)}
                              {cert.result && getResultBadge(cert.result)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-3">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground text-xs">Property</p>
                                <p className="font-medium" data-testid={`cert-address-${cert.id}`}>
                                  {cert.propertyAddress}
                                  {cert.propertyPostcode && `, ${cert.propertyPostcode}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground text-xs">Issue Date</p>
                                <p className="font-medium" data-testid={`cert-issue-${cert.id}`}>
                                  {format(new Date(cert.issueDate), "dd MMM yyyy")}
                                </p>
                              </div>
                            </div>

                            {cert.expiryDate && (
                              <div className="flex items-start gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-muted-foreground text-xs">Expiry Date</p>
                                  <p className={`font-medium ${differenceInDays(new Date(cert.expiryDate), new Date()) < 0 ? 'text-destructive' : differenceInDays(new Date(cert.expiryDate), new Date()) <= 30 ? 'text-yellow-600' : ''}`} data-testid={`cert-expiry-${cert.id}`}>
                                    {format(new Date(cert.expiryDate), "dd MMM yyyy")}
                                    {differenceInDays(new Date(cert.expiryDate), new Date()) < 0 && " (Expired)"}
                                  </p>
                                </div>
                              </div>
                            )}

                            {cert.engineerName && (
                              <div className="flex items-start gap-2">
                                <FileCheck className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-muted-foreground text-xs">Engineer</p>
                                  <p className="font-medium">{cert.engineerName}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex md:flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 md:flex-none"
                            onClick={() => handleViewCert(cert)}
                            data-testid={`btn-view-${cert.id}`}
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            View / Print
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="text-center text-sm text-muted-foreground space-y-1 print:hidden">
          <p>
            This is a secure client portal. Your access link is unique to you.
          </p>
          {companySettings?.companyName && (
            <p>
              For questions about your certificates, please contact {companySettings.companyName}.
            </p>
          )}
        </div>
      </div>

      {/* Printable Certificate View Sheet */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto print:!fixed print:!inset-0 print:!w-full print:!max-w-none print:!transform-none print:!shadow-none print:!rounded-none">
          <SheetHeader className="print:hidden">
            <SheetTitle>Certificate Details</SheetTitle>
          </SheetHeader>
          
          {selectedCert && (
            <div className="mt-4">
              {/* Print button */}
              <div className="flex justify-end mb-4 print:hidden">
                <Button onClick={handlePrint} data-testid="btn-print-certificate">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Certificate
                </Button>
              </div>

              {/* Printable Certificate Content */}
              <div className="printable-certificate border rounded-lg p-6 bg-white" data-testid="printable-certificate">
                {/* Header */}
                <div className="text-center border-b pb-4 mb-4">
                  {companySettings?.companyName && (
                    <h1 className="text-2xl font-bold text-primary">{companySettings.companyName}</h1>
                  )}
                  {companySettings?.companyAddress && (
                    <p className="text-sm text-muted-foreground">{companySettings.companyAddress}</p>
                  )}
                  <div className="flex justify-center gap-4 mt-1 text-sm text-muted-foreground">
                    {companySettings?.companyPhone && <span>{companySettings.companyPhone}</span>}
                    {companySettings?.companyEmail && <span>{companySettings.companyEmail}</span>}
                  </div>
                </div>

                {/* Certificate Title */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">{selectedCert.certificateType?.name || "Certificate"}</h2>
                  <p className="text-lg font-mono text-muted-foreground">{selectedCert.certificateNo}</p>
                </div>

                {/* Status and Result */}
                <div className="flex justify-center gap-4 mb-6">
                  {getStatusBadge(selectedCert.status, selectedCert.expiryDate)}
                  {selectedCert.result && getResultBadge(selectedCert.result)}
                </div>

                {/* Certificate Details */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="border rounded p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Property Address</p>
                    <div className="flex items-start gap-2 mt-1">
                      <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <p className="font-medium">
                        {selectedCert.propertyAddress}
                        {selectedCert.propertyPostcode && <>, {selectedCert.propertyPostcode}</>}
                      </p>
                    </div>
                  </div>
                  
                  <div className="border rounded p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Issue Date</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium">{format(new Date(selectedCert.issueDate), "dd MMMM yyyy")}</p>
                    </div>
                  </div>

                  {selectedCert.expiryDate && (
                    <div className="border rounded p-3">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Expiry Date</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <p className="font-medium">{format(new Date(selectedCert.expiryDate), "dd MMMM yyyy")}</p>
                      </div>
                    </div>
                  )}

                  {selectedCert.engineerName && (
                    <div className="border rounded p-3">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Inspected By</p>
                      <div className="flex items-center gap-2 mt-1">
                        <FileCheck className="w-4 h-4 text-muted-foreground" />
                        <p className="font-medium">{selectedCert.engineerName}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Client Details */}
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Issued To</p>
                  <p className="font-medium">{client.name}</p>
                  {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                </div>

                {/* Footer */}
                <div className="border-t mt-6 pt-4 text-center text-xs text-muted-foreground">
                  <p>This certificate is a digital record. Certificate No: {selectedCert.certificateNo}</p>
                  <p className="mt-1">Generated on {format(new Date(), "dd MMMM yyyy 'at' HH:mm")}</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
