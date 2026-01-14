import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarIcon, Search, FileCheck, Eye, Loader2, Eraser, Trash2, Printer, AlertTriangle, Bell, CheckCircle2, XCircle, Link2, Copy, Check } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import type { CertificateWithDetails, CertificateType, Client, ClientProperty } from "@shared/schema";

type EICRData = {
  installationType: string;
  maximumDemand: string;
  zsValue: string;
  r1r2Value: string;
  circuitsTested: string;
  eicrObservations: string;
};

type GasApplianceData = {
  applianceType: string;
  location: string;
  makeModel: string;
  operatingPressure: string;
  flueType: string;
  ventilation: boolean;
  coReading: string;
  co2Reading: string;
};

type CP12Data = {
  appliances: GasApplianceData[];
};

type BoilerData = {
  boilerMake: string;
  boilerModel: string;
  serialNumber: string;
  coCombustion: string;
  co2Combustion: string;
  o2Combustion: string;
  partsReplaced: string;
};

type PATApplianceData = {
  id: string;
  description: string;
  classType: string;
  visual: string;
  earth: string;
  insulation: string;
  result: string;
};

type PATData = {
  appliances: PATApplianceData[];
};

type FireAlarmData = {
  systemType: string;
  numberOfZones: string;
  numberOfDetectors: string;
  numberOfSounders: string;
  batteryCondition: string;
};

type SmokeAlarmLocation = {
  location: string;
  hasSmokeAlarm: boolean;
  smokeAlarmResult: string;
  hasCOAlarm: boolean;
  coAlarmResult: string;
};

type SmokeData = {
  locations: SmokeAlarmLocation[];
};

type CertificateData = EICRData | CP12Data | BoilerData | PATData | FireAlarmData | SmokeData | Record<string, unknown>;

const defaultEICRData: EICRData = {
  installationType: "",
  maximumDemand: "",
  zsValue: "",
  r1r2Value: "",
  circuitsTested: "",
  eicrObservations: "",
};

const defaultGasAppliance: GasApplianceData = {
  applianceType: "",
  location: "",
  makeModel: "",
  operatingPressure: "",
  flueType: "",
  ventilation: false,
  coReading: "",
  co2Reading: "",
};

const defaultCP12Data: CP12Data = {
  appliances: [
    { ...defaultGasAppliance },
    { ...defaultGasAppliance },
    { ...defaultGasAppliance },
  ],
};

const defaultBoilerData: BoilerData = {
  boilerMake: "",
  boilerModel: "",
  serialNumber: "",
  coCombustion: "",
  co2Combustion: "",
  o2Combustion: "",
  partsReplaced: "",
};

const defaultPATData: PATData = {
  appliances: [],
};

const defaultFireAlarmData: FireAlarmData = {
  systemType: "",
  numberOfZones: "",
  numberOfDetectors: "",
  numberOfSounders: "",
  batteryCondition: "",
};

const defaultSmokeLocation: SmokeAlarmLocation = {
  location: "",
  hasSmokeAlarm: false,
  smokeAlarmResult: "",
  hasCOAlarm: false,
  coAlarmResult: "",
};

const defaultSmokeData: SmokeData = {
  locations: [
    { ...defaultSmokeLocation, location: "Hallway" },
    { ...defaultSmokeLocation, location: "Landing" },
    { ...defaultSmokeLocation, location: "Kitchen" },
    { ...defaultSmokeLocation, location: "Living Room" },
  ],
};

type CertificateStatus = "valid" | "expiring_soon" | "expired";
type CertificateResult = "satisfactory" | "unsatisfactory" | "improvements_required";

const getStatusBadge = (status: string, expiryDate: Date | string | null) => {
  const expiry = expiryDate ? new Date(expiryDate) : null;
  const today = new Date();
  const daysUntilExpiry = expiry ? differenceInDays(expiry, today) : null;

  if (status === "expired" || (daysUntilExpiry !== null && daysUntilExpiry < 0)) {
    return <Badge variant="destructive" data-testid="badge-status-expired">Expired</Badge>;
  }
  if (status === "expiring_soon" || (daysUntilExpiry !== null && daysUntilExpiry <= 30)) {
    return <Badge className="bg-yellow-500 hover:bg-yellow-600" data-testid="badge-status-expiring">Expiring Soon</Badge>;
  }
  return <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-status-valid">Valid</Badge>;
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
      return <Badge variant="outline" data-testid="badge-result-unknown">-</Badge>;
  }
};

export default function Certificates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const signatureRef = useRef<SignatureCanvas>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateWithDetails | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [copyingPortalLinkFor, setCopyingPortalLinkFor] = useState<string | null>(null);
  const [copiedPortalLinkFor, setCopiedPortalLinkFor] = useState<string | null>(null);

  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyPostcode, setPropertyPostcode] = useState("");
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [result, setResult] = useState<CertificateResult>("satisfactory");
  const [observations, setObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [engineerName, setEngineerName] = useState("");
  const [engineerRegistration, setEngineerRegistration] = useState("");
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [certificateData, setCertificateData] = useState<CertificateData>({});

  const { data: certificates = [], isLoading: certificatesLoading } = useQuery<CertificateWithDetails[]>({
    queryKey: ["/api/certificates"],
  });

  const { data: certificateTypes = [] } = useQuery<CertificateType[]>({
    queryKey: ["/api/certificate-types"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: clientProperties = [] } = useQuery<ClientProperty[]>({
    queryKey: ["/api/clients", selectedClientId, "properties"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await fetch(`/api/clients/${selectedClientId}/properties`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  useEffect(() => {
    if (user?.name) {
      setEngineerName(user.name);
    }
  }, [user]);

  useEffect(() => {
    if (selectedPropertyId && clientProperties.length > 0) {
      const property = clientProperties.find(p => p.id === selectedPropertyId);
      if (property) {
        setPropertyAddress(property.address);
        setPropertyPostcode(property.postcode || "");
      }
    }
  }, [selectedPropertyId, clientProperties]);

  const getSelectedTypeShortCode = () => {
    const selectedType = certificateTypes.find(t => t.id === selectedTypeId);
    return selectedType?.shortCode || "";
  };

  useEffect(() => {
    const shortCode = getSelectedTypeShortCode();
    switch (shortCode) {
      case "EICR":
        setCertificateData({ ...defaultEICRData });
        break;
      case "CP12":
        setCertificateData({ ...defaultCP12Data, appliances: defaultCP12Data.appliances.map(a => ({ ...a })) });
        break;
      case "BOILER":
        setCertificateData({ ...defaultBoilerData });
        break;
      case "PAT":
        setCertificateData({ ...defaultPATData, appliances: [] });
        break;
      case "FIRE":
        setCertificateData({ ...defaultFireAlarmData });
        break;
      case "SMOKE":
        setCertificateData({ ...defaultSmokeData, locations: defaultSmokeData.locations.map(l => ({ ...l })) });
        break;
      default:
        setCertificateData({});
    }
  }, [selectedTypeId, certificateTypes]);

  const createCertificateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/certificates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      setCreateDialogOpen(false);
      resetForm();
      toast.success("Certificate created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create certificate");
    },
  });

  const resetForm = () => {
    setSelectedTypeId("");
    setSelectedClientId("");
    setSelectedPropertyId("");
    setPropertyAddress("");
    setPropertyPostcode("");
    setIssueDate(new Date());
    setResult("satisfactory");
    setObservations("");
    setRecommendations("");
    setEngineerName(user?.name || "");
    setEngineerRegistration("");
    signatureRef.current?.clear();
    setSignatureEmpty(true);
    setCertificateData({});
  };

  const handleCreateCertificate = () => {
    if (!selectedTypeId || !propertyAddress || !issueDate || signatureEmpty) {
      toast.error("Please fill in all required fields and sign the certificate");
      return;
    }

    const selectedType = certificateTypes.find(t => t.id === selectedTypeId);
    const expiryMonths = selectedType?.expiryMonths || 12;
    const expiryDate = new Date(issueDate);
    expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

    createCertificateMutation.mutate({
      certificateTypeId: selectedTypeId,
      clientId: selectedClientId || null,
      propertyId: selectedPropertyId || null,
      propertyAddress,
      propertyPostcode,
      issueDate,
      expiryDate,
      result,
      observations,
      recommendations,
      engineerName,
      engineerId: user?.id,
      engineerRegistration,
      engineerSignature: signatureRef.current?.toDataURL() || null,
      certificateData,
      status: "valid",
    });
  };

  const updateEICRData = (field: keyof EICRData, value: string) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };

  const updateCP12Appliance = (index: number, field: keyof GasApplianceData, value: string | boolean) => {
    setCertificateData(prev => {
      const data = prev as CP12Data;
      const appliances = [...(data.appliances || [])];
      appliances[index] = { ...appliances[index], [field]: value };
      return { ...data, appliances };
    });
  };

  const updateBoilerData = (field: keyof BoilerData, value: string) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };

  const addPATAppliance = () => {
    setCertificateData(prev => {
      const data = prev as PATData;
      const newAppliance: PATApplianceData = {
        id: Date.now().toString(),
        description: "",
        classType: "",
        visual: "",
        earth: "",
        insulation: "",
        result: "",
      };
      return { ...data, appliances: [...(data.appliances || []), newAppliance] };
    });
  };

  const removePATAppliance = (id: string) => {
    setCertificateData(prev => {
      const data = prev as PATData;
      return { ...data, appliances: data.appliances.filter(a => a.id !== id) };
    });
  };

  const updatePATAppliance = (id: string, field: keyof PATApplianceData, value: string) => {
    setCertificateData(prev => {
      const data = prev as PATData;
      return {
        ...data,
        appliances: data.appliances.map(a =>
          a.id === id ? { ...a, [field]: value } : a
        ),
      };
    });
  };

  const updateFireAlarmData = (field: keyof FireAlarmData, value: string) => {
    setCertificateData(prev => ({ ...prev, [field]: value }));
  };

  const updateSmokeLocation = (index: number, field: keyof SmokeAlarmLocation, value: string | boolean) => {
    setCertificateData(prev => {
      const data = prev as SmokeData;
      const locations = [...(data.locations || [])];
      locations[index] = { ...locations[index], [field]: value };
      return { ...data, locations };
    });
  };

  const addSmokeLocation = () => {
    setCertificateData(prev => {
      const data = prev as SmokeData;
      return {
        ...data,
        locations: [...(data.locations || []), { ...defaultSmokeLocation }],
      };
    });
  };

  const removeSmokeLocation = (index: number) => {
    setCertificateData(prev => {
      const data = prev as SmokeData;
      return {
        ...data,
        locations: data.locations.filter((_, i) => i !== index),
      };
    });
  };

  const checkSignature = () => {
    setSignatureEmpty(signatureRef.current?.isEmpty() ?? true);
  };

  const renderEICRDetails = (data: EICRData) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {data.installationType && (
          <div>
            <p className="text-sm text-muted-foreground">Installation Type</p>
            <p className="font-medium capitalize">{data.installationType}</p>
          </div>
        )}
        {data.maximumDemand && (
          <div>
            <p className="text-sm text-muted-foreground">Maximum Demand</p>
            <p className="font-medium">{data.maximumDemand}</p>
          </div>
        )}
        {data.zsValue && (
          <div>
            <p className="text-sm text-muted-foreground">Zs Value</p>
            <p className="font-medium">{data.zsValue}</p>
          </div>
        )}
        {data.r1r2Value && (
          <div>
            <p className="text-sm text-muted-foreground">R1+R2 Value</p>
            <p className="font-medium">{data.r1r2Value}</p>
          </div>
        )}
        {data.circuitsTested && (
          <div>
            <p className="text-sm text-muted-foreground">Circuits Tested</p>
            <p className="font-medium">{data.circuitsTested}</p>
          </div>
        )}
      </div>
      {data.eicrObservations && (
        <div>
          <p className="text-sm text-muted-foreground">EICR Observations</p>
          <p className="font-medium whitespace-pre-wrap">{data.eicrObservations}</p>
        </div>
      )}
    </div>
  );

  const renderCP12Details = (data: CP12Data) => (
    <div className="space-y-4">
      {(data.appliances || []).filter(a => a.applianceType).map((appliance, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-2">
          <h5 className="font-medium text-sm">Appliance {index + 1}: {appliance.applianceType?.replace("_", " ") || "-"}</h5>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {appliance.location && (
              <div>
                <span className="text-muted-foreground">Location:</span> {appliance.location}
              </div>
            )}
            {appliance.makeModel && (
              <div>
                <span className="text-muted-foreground">Make/Model:</span> {appliance.makeModel}
              </div>
            )}
            {appliance.operatingPressure && (
              <div>
                <span className="text-muted-foreground">Pressure:</span> {appliance.operatingPressure}
              </div>
            )}
            {appliance.flueType && (
              <div>
                <span className="text-muted-foreground">Flue:</span> {appliance.flueType?.replace("_", " ")}
              </div>
            )}
            {appliance.coReading && (
              <div>
                <span className="text-muted-foreground">CO:</span> {appliance.coReading}
              </div>
            )}
            {appliance.co2Reading && (
              <div>
                <span className="text-muted-foreground">CO₂:</span> {appliance.co2Reading}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Ventilation:</span> {appliance.ventilation ? "Adequate" : "N/A"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBoilerDetails = (data: BoilerData) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {data.boilerMake && (
          <div>
            <p className="text-sm text-muted-foreground">Boiler Make</p>
            <p className="font-medium">{data.boilerMake}</p>
          </div>
        )}
        {data.boilerModel && (
          <div>
            <p className="text-sm text-muted-foreground">Boiler Model</p>
            <p className="font-medium">{data.boilerModel}</p>
          </div>
        )}
        {data.serialNumber && (
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Serial Number</p>
            <p className="font-medium">{data.serialNumber}</p>
          </div>
        )}
      </div>
      {(data.coCombustion || data.co2Combustion || data.o2Combustion) && (
        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-2">Combustion Analysis</p>
          <div className="grid grid-cols-3 gap-4">
            {data.coCombustion && (
              <div>
                <p className="text-sm text-muted-foreground">CO</p>
                <p className="font-medium">{data.coCombustion} ppm</p>
              </div>
            )}
            {data.co2Combustion && (
              <div>
                <p className="text-sm text-muted-foreground">CO₂</p>
                <p className="font-medium">{data.co2Combustion}%</p>
              </div>
            )}
            {data.o2Combustion && (
              <div>
                <p className="text-sm text-muted-foreground">O₂</p>
                <p className="font-medium">{data.o2Combustion}%</p>
              </div>
            )}
          </div>
        </div>
      )}
      {data.partsReplaced && (
        <div>
          <p className="text-sm text-muted-foreground">Parts Replaced</p>
          <p className="font-medium whitespace-pre-wrap">{data.partsReplaced}</p>
        </div>
      )}
    </div>
  );

  const renderPATDetails = (data: PATData) => (
    <div className="overflow-x-auto">
      {(data.appliances || []).length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Visual</TableHead>
              <TableHead>Earth</TableHead>
              <TableHead>Insulation</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.appliances.map((appliance, index) => (
              <TableRow key={index}>
                <TableCell>{appliance.description || "-"}</TableCell>
                <TableCell>{appliance.classType || "-"}</TableCell>
                <TableCell>
                  <Badge variant={appliance.visual === "pass" ? "default" : "destructive"}>
                    {appliance.visual || "-"}
                  </Badge>
                </TableCell>
                <TableCell>{appliance.earth || "-"}</TableCell>
                <TableCell>{appliance.insulation || "-"}</TableCell>
                <TableCell>
                  <Badge variant={appliance.result === "pass" ? "default" : "destructive"}>
                    {appliance.result || "-"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No appliances recorded</p>
      )}
    </div>
  );

  const renderFireAlarmDetails = (data: FireAlarmData) => (
    <div className="grid grid-cols-2 gap-4">
      {data.systemType && (
        <div>
          <p className="text-sm text-muted-foreground">System Type</p>
          <p className="font-medium capitalize">{data.systemType}</p>
        </div>
      )}
      {data.batteryCondition && (
        <div>
          <p className="text-sm text-muted-foreground">Battery Condition</p>
          <Badge variant={data.batteryCondition === "good" ? "default" : data.batteryCondition === "replace_now" ? "destructive" : "secondary"}>
            {data.batteryCondition?.replace("_", " ")}
          </Badge>
        </div>
      )}
      {data.numberOfZones && (
        <div>
          <p className="text-sm text-muted-foreground">Zones</p>
          <p className="font-medium">{data.numberOfZones}</p>
        </div>
      )}
      {data.numberOfDetectors && (
        <div>
          <p className="text-sm text-muted-foreground">Detectors</p>
          <p className="font-medium">{data.numberOfDetectors}</p>
        </div>
      )}
      {data.numberOfSounders && (
        <div>
          <p className="text-sm text-muted-foreground">Sounders</p>
          <p className="font-medium">{data.numberOfSounders}</p>
        </div>
      )}
    </div>
  );

  const renderSmokeDetails = (data: SmokeData) => (
    <div className="space-y-3">
      {(data.locations || []).filter(l => l.location).map((loc, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-2">
          <h5 className="font-medium text-sm">{loc.location}</h5>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Smoke Alarm:</span>
              {loc.hasSmokeAlarm ? (
                <Badge variant={loc.smokeAlarmResult === "pass" ? "default" : loc.smokeAlarmResult === "fail" ? "destructive" : "secondary"}>
                  {loc.smokeAlarmResult || "Installed"}
                </Badge>
              ) : (
                <span>Not installed</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">CO Alarm:</span>
              {loc.hasCOAlarm ? (
                <Badge variant={loc.coAlarmResult === "pass" ? "default" : loc.coAlarmResult === "fail" ? "destructive" : "secondary"}>
                  {loc.coAlarmResult || "Installed"}
                </Badge>
              ) : (
                <span>Not installed</span>
              )}
            </div>
          </div>
        </div>
      ))}
      {(data.locations || []).filter(l => l.location).length === 0 && (
        <p className="text-sm text-muted-foreground">No locations recorded</p>
      )}
    </div>
  );

  const viewCertificateDetails = (certificate: CertificateWithDetails) => {
    setSelectedCertificate(certificate);
    setViewSheetOpen(true);
  };

  const handlePrintCertificate = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setShowPrintView(false);
      }, 500);
    }, 100);
  };

  const copyPortalLink = async (clientId: string) => {
    if (!clientId) {
      toast.error("No client linked to this certificate");
      return;
    }

    setCopyingPortalLinkFor(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate portal link");
      }

      const data = await res.json();
      await navigator.clipboard.writeText(data.portalUrl);
      setCopiedPortalLinkFor(clientId);
      toast.success("Portal link copied to clipboard!");
      
      setTimeout(() => {
        setCopiedPortalLinkFor(null);
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to copy portal link");
    } finally {
      setCopyingPortalLinkFor(null);
    }
  };

  const getCertificateTitle = (shortCode: string | undefined) => {
    switch (shortCode) {
      case "CP12":
        return "Gas Safety Certificate (CP12)";
      case "EICR":
        return "Electrical Installation Condition Report";
      case "BOILER":
        return "Boiler Service Certificate";
      case "PAT":
        return "Portable Appliance Testing Certificate";
      case "FIRE":
        return "Fire Alarm Test Certificate";
      case "SMOKE":
        return "Smoke & CO Alarm Certificate";
      default:
        return "Compliance Certificate";
    }
  };

  const getResultText = (result: string | null) => {
    switch (result) {
      case "satisfactory":
        return "SATISFACTORY";
      case "unsatisfactory":
        return "UNSATISFACTORY";
      case "improvements_required":
        return "IMPROVEMENTS REQUIRED";
      default:
        return "-";
    }
  };

  const renderPrintEICRDetails = (data: EICRData) => (
    <table className="print-table">
      <tbody>
        {data.installationType && (
          <tr>
            <td className="label-cell">Installation Type</td>
            <td className="value-cell capitalize">{data.installationType}</td>
          </tr>
        )}
        {data.maximumDemand && (
          <tr>
            <td className="label-cell">Maximum Demand</td>
            <td className="value-cell">{data.maximumDemand}</td>
          </tr>
        )}
        {data.zsValue && (
          <tr>
            <td className="label-cell">Zs Value (Ω)</td>
            <td className="value-cell">{data.zsValue}</td>
          </tr>
        )}
        {data.r1r2Value && (
          <tr>
            <td className="label-cell">R1+R2 Value (Ω)</td>
            <td className="value-cell">{data.r1r2Value}</td>
          </tr>
        )}
        {data.circuitsTested && (
          <tr>
            <td className="label-cell">Circuits Tested</td>
            <td className="value-cell">{data.circuitsTested}</td>
          </tr>
        )}
        {data.eicrObservations && (
          <tr>
            <td className="label-cell">EICR Observations</td>
            <td className="value-cell">{data.eicrObservations}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderPrintCP12Details = (data: CP12Data) => (
    <div className="print-appliances">
      {(data.appliances || []).filter(a => a.applianceType).map((appliance, index) => (
        <div key={index} className="print-appliance-card">
          <h4 className="print-appliance-title">Appliance {index + 1}: {appliance.applianceType?.replace("_", " ") || "-"}</h4>
          <table className="print-table">
            <tbody>
              {appliance.location && (
                <tr>
                  <td className="label-cell">Location</td>
                  <td className="value-cell">{appliance.location}</td>
                </tr>
              )}
              {appliance.makeModel && (
                <tr>
                  <td className="label-cell">Make/Model</td>
                  <td className="value-cell">{appliance.makeModel}</td>
                </tr>
              )}
              {appliance.operatingPressure && (
                <tr>
                  <td className="label-cell">Operating Pressure</td>
                  <td className="value-cell">{appliance.operatingPressure}</td>
                </tr>
              )}
              {appliance.flueType && (
                <tr>
                  <td className="label-cell">Flue Type</td>
                  <td className="value-cell capitalize">{appliance.flueType?.replace("_", " ")}</td>
                </tr>
              )}
              {appliance.coReading && (
                <tr>
                  <td className="label-cell">CO Reading</td>
                  <td className="value-cell">{appliance.coReading} ppm</td>
                </tr>
              )}
              {appliance.co2Reading && (
                <tr>
                  <td className="label-cell">CO₂ Reading</td>
                  <td className="value-cell">{appliance.co2Reading}%</td>
                </tr>
              )}
              <tr>
                <td className="label-cell">Ventilation</td>
                <td className="value-cell">{appliance.ventilation ? "Adequate" : "N/A"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  const renderPrintBoilerDetails = (data: BoilerData) => (
    <div>
      <table className="print-table">
        <tbody>
          {data.boilerMake && (
            <tr>
              <td className="label-cell">Boiler Make</td>
              <td className="value-cell">{data.boilerMake}</td>
            </tr>
          )}
          {data.boilerModel && (
            <tr>
              <td className="label-cell">Boiler Model</td>
              <td className="value-cell">{data.boilerModel}</td>
            </tr>
          )}
          {data.serialNumber && (
            <tr>
              <td className="label-cell">Serial Number</td>
              <td className="value-cell">{data.serialNumber}</td>
            </tr>
          )}
        </tbody>
      </table>
      {(data.coCombustion || data.co2Combustion || data.o2Combustion) && (
        <div className="print-section-inner">
          <h4 className="print-subsection-title">Combustion Analysis</h4>
          <table className="print-table">
            <tbody>
              {data.coCombustion && (
                <tr>
                  <td className="label-cell">CO</td>
                  <td className="value-cell">{data.coCombustion} ppm</td>
                </tr>
              )}
              {data.co2Combustion && (
                <tr>
                  <td className="label-cell">CO₂</td>
                  <td className="value-cell">{data.co2Combustion}%</td>
                </tr>
              )}
              {data.o2Combustion && (
                <tr>
                  <td className="label-cell">O₂</td>
                  <td className="value-cell">{data.o2Combustion}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {data.partsReplaced && (
        <div className="print-section-inner">
          <h4 className="print-subsection-title">Parts Replaced</h4>
          <p className="print-text">{data.partsReplaced}</p>
        </div>
      )}
    </div>
  );

  const renderPrintPATDetails = (data: PATData) => (
    <div className="print-pat-table">
      {(data.appliances || []).length > 0 ? (
        <table className="print-table-full">
          <thead>
            <tr>
              <th>Description</th>
              <th>Class</th>
              <th>Visual</th>
              <th>Earth (Ω)</th>
              <th>Insulation (MΩ)</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {data.appliances.map((appliance, index) => (
              <tr key={index}>
                <td>{appliance.description || "-"}</td>
                <td>{appliance.classType || "-"}</td>
                <td className={appliance.visual === "pass" ? "result-pass" : "result-fail"}>
                  {appliance.visual?.toUpperCase() || "-"}
                </td>
                <td>{appliance.earth || "-"}</td>
                <td>{appliance.insulation || "-"}</td>
                <td className={appliance.result === "pass" ? "result-pass" : "result-fail"}>
                  {appliance.result?.toUpperCase() || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="print-text">No appliances recorded</p>
      )}
    </div>
  );

  const renderPrintFireAlarmDetails = (data: FireAlarmData) => (
    <table className="print-table">
      <tbody>
        {data.systemType && (
          <tr>
            <td className="label-cell">System Type</td>
            <td className="value-cell capitalize">{data.systemType}</td>
          </tr>
        )}
        {data.batteryCondition && (
          <tr>
            <td className="label-cell">Battery Condition</td>
            <td className="value-cell capitalize">{data.batteryCondition?.replace("_", " ")}</td>
          </tr>
        )}
        {data.numberOfZones && (
          <tr>
            <td className="label-cell">Number of Zones</td>
            <td className="value-cell">{data.numberOfZones}</td>
          </tr>
        )}
        {data.numberOfDetectors && (
          <tr>
            <td className="label-cell">Number of Detectors</td>
            <td className="value-cell">{data.numberOfDetectors}</td>
          </tr>
        )}
        {data.numberOfSounders && (
          <tr>
            <td className="label-cell">Number of Sounders</td>
            <td className="value-cell">{data.numberOfSounders}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderPrintSmokeDetails = (data: SmokeData) => (
    <div className="print-smoke-table">
      {(data.locations || []).filter(l => l.location).length > 0 ? (
        <table className="print-table-full">
          <thead>
            <tr>
              <th>Location</th>
              <th>Smoke Alarm</th>
              <th>Smoke Result</th>
              <th>CO Alarm</th>
              <th>CO Result</th>
            </tr>
          </thead>
          <tbody>
            {(data.locations || []).filter(l => l.location).map((loc, index) => (
              <tr key={index}>
                <td>{loc.location}</td>
                <td>{loc.hasSmokeAlarm ? "Yes" : "No"}</td>
                <td className={loc.smokeAlarmResult === "pass" ? "result-pass" : loc.smokeAlarmResult === "fail" ? "result-fail" : ""}>
                  {loc.smokeAlarmResult?.toUpperCase() || "-"}
                </td>
                <td>{loc.hasCOAlarm ? "Yes" : "No"}</td>
                <td className={loc.coAlarmResult === "pass" ? "result-pass" : loc.coAlarmResult === "fail" ? "result-fail" : ""}>
                  {loc.coAlarmResult?.toUpperCase() || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="print-text">No locations recorded</p>
      )}
    </div>
  );

  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch =
      cert.certificateNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cert.client?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || cert.certificateTypeId === filterType;

    let matchesStatus = true;
    if (filterStatus !== "all") {
      const expiry = cert.expiryDate ? new Date(cert.expiryDate) : null;
      const today = new Date();
      const daysUntilExpiry = expiry ? differenceInDays(expiry, today) : null;

      if (filterStatus === "expired") {
        matchesStatus = cert.status === "expired" || (daysUntilExpiry !== null && daysUntilExpiry < 0);
      } else if (filterStatus === "expiring_soon") {
        matchesStatus = cert.status === "expiring_soon" || (daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30);
      } else if (filterStatus === "valid") {
        matchesStatus = cert.status === "valid" && (daysUntilExpiry === null || daysUntilExpiry > 30);
      }
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  const certificateStats = useMemo(() => {
    const today = new Date();
    let valid = 0;
    let expiringSoon = 0;
    let expired = 0;

    certificates.forEach((cert) => {
      const expiry = cert.expiryDate ? new Date(cert.expiryDate) : null;
      const daysUntilExpiry = expiry ? differenceInDays(expiry, today) : null;

      if (cert.status === "expired" || (daysUntilExpiry !== null && daysUntilExpiry < 0)) {
        expired++;
      } else if (cert.status === "expiring_soon" || (daysUntilExpiry !== null && daysUntilExpiry <= 30)) {
        expiringSoon++;
      } else {
        valid++;
      }
    });

    return { total: certificates.length, valid, expiringSoon, expired };
  }, [certificates]);

  const expiringCertificates = useMemo(() => {
    const today = new Date();
    return certificates
      .filter((cert) => {
        const expiry = cert.expiryDate ? new Date(cert.expiryDate) : null;
        if (!expiry) return false;
        const daysUntilExpiry = differenceInDays(expiry, today);
        return daysUntilExpiry <= 30;
      })
      .map((cert) => {
        const expiry = new Date(cert.expiryDate!);
        const daysUntilExpiry = differenceInDays(expiry, today);
        return { ...cert, daysUntilExpiry };
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [certificates]);

  const getExpiryRowClass = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0 || daysUntilExpiry <= 7) {
      return "bg-red-50 dark:bg-red-950/30";
    } else if (daysUntilExpiry <= 14) {
      return "bg-amber-50 dark:bg-amber-950/30";
    } else {
      return "bg-yellow-50 dark:bg-yellow-950/20";
    }
  };

  const handleSendReminder = (cert: CertificateWithDetails) => {
    toast.success(`Reminder sent for certificate ${cert.certificateNo}`);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-certificates-title">Certificates</h1>
          <p className="text-muted-foreground">
            Manage compliance certificates and track expiry dates
          </p>
        </div>

        <Button size="lg" className="w-full sm:w-auto" onClick={() => setCreateDialogOpen(true)} data-testid="button-new-certificate">
          <Plus className="mr-2 h-5 w-5" />
          New Certificate
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("all")} data-testid="card-total-certificates">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500 rounded-lg">
                <FileCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificateStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Certificates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("valid")} data-testid="card-valid-certificates">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificateStats.valid}</p>
                <p className="text-xs text-muted-foreground">Valid</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("expiring_soon")} data-testid="card-expiring-certificates">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificateStats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("expired")} data-testid="card-expired-certificates">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <XCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificateStats.expired}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {expiringCertificates.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Expiring Soon Alert
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Certificates expiring within the next 30 days
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Property</TableHead>
                    <TableHead className="hidden lg:table-cell">Client</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringCertificates.map((cert) => (
                    <TableRow key={cert.id} className={getExpiryRowClass(cert.daysUntilExpiry)} data-testid={`row-expiring-${cert.id}`}>
                      <TableCell className="font-medium">{cert.certificateNo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cert.certificateType?.shortCode || cert.certificateType?.name || "-"}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                        {cert.propertyAddress}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {cert.client?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {cert.expiryDate ? format(new Date(cert.expiryDate), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={cert.daysUntilExpiry < 0 ? "destructive" : cert.daysUntilExpiry <= 7 ? "destructive" : cert.daysUntilExpiry <= 14 ? "secondary" : "outline"}
                          className={cert.daysUntilExpiry <= 7 ? "" : cert.daysUntilExpiry <= 14 ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}
                        >
                          {cert.daysUntilExpiry < 0 ? `${Math.abs(cert.daysUntilExpiry)} days ago` : cert.daysUntilExpiry === 0 ? "Today" : `${cert.daysUntilExpiry} days`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(cert)}
                          data-testid={`button-reminder-${cert.id}`}
                        >
                          <Bell className="h-4 w-4 mr-1" />
                          Send Reminder
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">Filters</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("all")}
                data-testid="button-filter-all"
              >
                All
              </Button>
              <Button
                variant={filterStatus === "valid" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("valid")}
                className={filterStatus === "valid" ? "bg-green-500 hover:bg-green-600" : ""}
                data-testid="button-filter-valid"
              >
                Valid
              </Button>
              <Button
                variant={filterStatus === "expiring_soon" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("expiring_soon")}
                className={filterStatus === "expiring_soon" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                data-testid="button-filter-expiring"
              >
                Expiring Soon
              </Button>
              <Button
                variant={filterStatus === "expired" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus("expired")}
                className={filterStatus === "expired" ? "bg-red-500 hover:bg-red-600" : ""}
                data-testid="button-filter-expired"
              >
                Expired
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by certificate no, address, or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-certificates"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger data-testid="select-filter-type">
                  <SelectValue placeholder="Certificate Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {certificateTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {certificatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No certificates found</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm || filterType !== "all" || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first certificate to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Property Address</TableHead>
                    <TableHead className="hidden lg:table-cell">Client</TableHead>
                    <TableHead className="hidden sm:table-cell">Issue Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Result</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCertificates.map((cert) => (
                    <TableRow key={cert.id} data-testid={`row-certificate-${cert.id}`}>
                      <TableCell className="font-medium">{cert.certificateNo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cert.certificateType?.shortCode || cert.certificateType?.name || "-"}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                        {cert.propertyAddress}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {cert.client?.name || "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {cert.issueDate ? format(new Date(cert.issueDate), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {cert.expiryDate ? format(new Date(cert.expiryDate), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(cert.status, cert.expiryDate)}</TableCell>
                      <TableCell className="hidden md:table-cell">{getResultBadge(cert.result)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewCertificateDetails(cert)}
                            data-testid={`button-view-${cert.id}`}
                            title="View certificate"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {cert.client?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyPortalLink(cert.client!.id)}
                              disabled={copyingPortalLinkFor === cert.client!.id}
                              data-testid={`button-copy-portal-${cert.id}`}
                              title="Copy client portal link"
                            >
                              {copyingPortalLinkFor === cert.client!.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : copiedPortalLinkFor === cert.client!.id ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Link2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Certificate</DialogTitle>
            <DialogDescription>
              Fill in the certificate details and sign to create a new compliance certificate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="certificate-type">Certificate Type *</Label>
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger data-testid="select-certificate-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {certificateTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} ({type.shortCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client (Optional)</Label>
                <Select value={selectedClientId} onValueChange={(val) => {
                  setSelectedClientId(val);
                  setSelectedPropertyId("");
                }}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedClientId && clientProperties.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="property">Property (Optional)</Label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger data-testid="select-property">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Manual entry</SelectItem>
                    {clientProperties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name} - {property.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Property Address *</Label>
                <Input
                  id="address"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="Enter property address"
                  data-testid="input-property-address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={propertyPostcode}
                  onChange={(e) => setPropertyPostcode(e.target.value)}
                  placeholder="Enter postcode"
                  data-testid="input-property-postcode"
                />
              </div>

              <div className="space-y-2">
                <Label>Issue Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-issue-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {issueDate ? format(issueDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={issueDate}
                      onSelect={setIssueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="result">Result *</Label>
              <Select value={result} onValueChange={(val) => setResult(val as CertificateResult)}>
                <SelectTrigger data-testid="select-result">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="satisfactory">Satisfactory</SelectItem>
                  <SelectItem value="unsatisfactory">Unsatisfactory</SelectItem>
                  <SelectItem value="improvements_required">Improvements Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {getSelectedTypeShortCode() === "EICR" && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-medium">EICR Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Installation Type</Label>
                    <Select
                      value={(certificateData as EICRData).installationType || ""}
                      onValueChange={(val) => updateEICRData("installationType", val)}
                    >
                      <SelectTrigger data-testid="select-eicr-installation-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="domestic">Domestic</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Demand (A)</Label>
                    <Input
                      value={(certificateData as EICRData).maximumDemand || ""}
                      onChange={(e) => updateEICRData("maximumDemand", e.target.value)}
                      placeholder="e.g., 100A"
                      data-testid="input-eicr-max-demand"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zs Value (Ω)</Label>
                    <Input
                      value={(certificateData as EICRData).zsValue || ""}
                      onChange={(e) => updateEICRData("zsValue", e.target.value)}
                      placeholder="e.g., 0.35Ω"
                      data-testid="input-eicr-zs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>R1+R2 Value (Ω)</Label>
                    <Input
                      value={(certificateData as EICRData).r1r2Value || ""}
                      onChange={(e) => updateEICRData("r1r2Value", e.target.value)}
                      placeholder="e.g., 0.25Ω"
                      data-testid="input-eicr-r1r2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Circuits Tested</Label>
                    <Input
                      type="number"
                      value={(certificateData as EICRData).circuitsTested || ""}
                      onChange={(e) => updateEICRData("circuitsTested", e.target.value)}
                      placeholder="Number of circuits"
                      data-testid="input-eicr-circuits"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>EICR Observations</Label>
                  <Textarea
                    value={(certificateData as EICRData).eicrObservations || ""}
                    onChange={(e) => updateEICRData("eicrObservations", e.target.value)}
                    placeholder="Specific electrical observations..."
                    rows={3}
                    data-testid="textarea-eicr-observations"
                  />
                </div>
              </div>
            )}

            {getSelectedTypeShortCode() === "CP12" && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-medium">Gas Appliances</h4>
                {((certificateData as CP12Data).appliances || []).map((appliance, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 bg-background">
                    <h5 className="font-medium text-sm">Appliance {index + 1}</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Appliance Type</Label>
                        <Select
                          value={appliance.applianceType}
                          onValueChange={(val) => updateCP12Appliance(index, "applianceType", val)}
                        >
                          <SelectTrigger data-testid={`select-cp12-appliance-type-${index}`}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boiler">Boiler</SelectItem>
                            <SelectItem value="fire">Gas Fire</SelectItem>
                            <SelectItem value="cooker">Cooker</SelectItem>
                            <SelectItem value="water_heater">Water Heater</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Input
                          value={appliance.location}
                          onChange={(e) => updateCP12Appliance(index, "location", e.target.value)}
                          placeholder="e.g., Kitchen"
                          data-testid={`input-cp12-location-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Make/Model</Label>
                        <Input
                          value={appliance.makeModel}
                          onChange={(e) => updateCP12Appliance(index, "makeModel", e.target.value)}
                          placeholder="e.g., Worcester Bosch"
                          data-testid={`input-cp12-make-model-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Operating Pressure (mbar)</Label>
                        <Input
                          value={appliance.operatingPressure}
                          onChange={(e) => updateCP12Appliance(index, "operatingPressure", e.target.value)}
                          placeholder="e.g., 20 mbar"
                          data-testid={`input-cp12-pressure-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Flue Type</Label>
                        <Select
                          value={appliance.flueType}
                          onValueChange={(val) => updateCP12Appliance(index, "flueType", val)}
                        >
                          <SelectTrigger data-testid={`select-cp12-flue-${index}`}>
                            <SelectValue placeholder="Select flue type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open_flue">Open Flue</SelectItem>
                            <SelectItem value="room_sealed">Room Sealed</SelectItem>
                            <SelectItem value="balanced_flue">Balanced Flue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>CO Reading (ppm)</Label>
                        <Input
                          value={appliance.coReading}
                          onChange={(e) => updateCP12Appliance(index, "coReading", e.target.value)}
                          placeholder="e.g., 45 ppm"
                          data-testid={`input-cp12-co-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CO₂ Reading (%)</Label>
                        <Input
                          value={appliance.co2Reading}
                          onChange={(e) => updateCP12Appliance(index, "co2Reading", e.target.value)}
                          placeholder="e.g., 9.5%"
                          data-testid={`input-cp12-co2-${index}`}
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Checkbox
                          id={`ventilation-${index}`}
                          checked={appliance.ventilation}
                          onCheckedChange={(checked) => updateCP12Appliance(index, "ventilation", !!checked)}
                          data-testid={`checkbox-cp12-ventilation-${index}`}
                        />
                        <Label htmlFor={`ventilation-${index}`}>Ventilation Adequate</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {getSelectedTypeShortCode() === "BOILER" && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-medium">Boiler Service Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Boiler Make</Label>
                    <Input
                      value={(certificateData as BoilerData).boilerMake || ""}
                      onChange={(e) => updateBoilerData("boilerMake", e.target.value)}
                      placeholder="e.g., Worcester Bosch"
                      data-testid="input-boiler-make"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Boiler Model</Label>
                    <Input
                      value={(certificateData as BoilerData).boilerModel || ""}
                      onChange={(e) => updateBoilerData("boilerModel", e.target.value)}
                      placeholder="e.g., Greenstar 8000"
                      data-testid="input-boiler-model"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Serial Number</Label>
                    <Input
                      value={(certificateData as BoilerData).serialNumber || ""}
                      onChange={(e) => updateBoilerData("serialNumber", e.target.value)}
                      placeholder="Enter serial number"
                      data-testid="input-boiler-serial"
                    />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h5 className="font-medium text-sm mb-3">Combustion Analysis</h5>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>CO (ppm)</Label>
                      <Input
                        value={(certificateData as BoilerData).coCombustion || ""}
                        onChange={(e) => updateBoilerData("coCombustion", e.target.value)}
                        placeholder="e.g., 45"
                        data-testid="input-boiler-co"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CO₂ (%)</Label>
                      <Input
                        value={(certificateData as BoilerData).co2Combustion || ""}
                        onChange={(e) => updateBoilerData("co2Combustion", e.target.value)}
                        placeholder="e.g., 9.5"
                        data-testid="input-boiler-co2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>O₂ (%)</Label>
                      <Input
                        value={(certificateData as BoilerData).o2Combustion || ""}
                        onChange={(e) => updateBoilerData("o2Combustion", e.target.value)}
                        placeholder="e.g., 4.5"
                        data-testid="input-boiler-o2"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Parts Replaced</Label>
                  <Textarea
                    value={(certificateData as BoilerData).partsReplaced || ""}
                    onChange={(e) => updateBoilerData("partsReplaced", e.target.value)}
                    placeholder="List any parts replaced during service..."
                    rows={3}
                    data-testid="textarea-boiler-parts"
                  />
                </div>
              </div>
            )}

            {getSelectedTypeShortCode() === "PAT" && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Appliances Tested</h4>
                  <Button type="button" size="sm" onClick={addPATAppliance} data-testid="button-add-pat-appliance">
                    <Plus className="h-4 w-4 mr-1" /> Add Appliance
                  </Button>
                </div>
                {((certificateData as PATData).appliances || []).length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Visual</TableHead>
                          <TableHead>Earth</TableHead>
                          <TableHead>Insulation</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {((certificateData as PATData).appliances || []).map((appliance) => (
                          <TableRow key={appliance.id}>
                            <TableCell>
                              <Input
                                value={appliance.description}
                                onChange={(e) => updatePATAppliance(appliance.id, "description", e.target.value)}
                                placeholder="e.g., Kettle"
                                className="min-w-[120px]"
                                data-testid={`input-pat-desc-${appliance.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={appliance.classType}
                                onValueChange={(val) => updatePATAppliance(appliance.id, "classType", val)}
                              >
                                <SelectTrigger className="w-[80px]" data-testid={`select-pat-class-${appliance.id}`}>
                                  <SelectValue placeholder="Class" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="I">I</SelectItem>
                                  <SelectItem value="II">II</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={appliance.visual}
                                onValueChange={(val) => updatePATAppliance(appliance.id, "visual", val)}
                              >
                                <SelectTrigger className="w-[80px]" data-testid={`select-pat-visual-${appliance.id}`}>
                                  <SelectValue placeholder="Result" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pass">Pass</SelectItem>
                                  <SelectItem value="fail">Fail</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={appliance.earth}
                                onChange={(e) => updatePATAppliance(appliance.id, "earth", e.target.value)}
                                placeholder="Ω"
                                className="w-[70px]"
                                data-testid={`input-pat-earth-${appliance.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={appliance.insulation}
                                onChange={(e) => updatePATAppliance(appliance.id, "insulation", e.target.value)}
                                placeholder="MΩ"
                                className="w-[70px]"
                                data-testid={`input-pat-insulation-${appliance.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={appliance.result}
                                onValueChange={(val) => updatePATAppliance(appliance.id, "result", val)}
                              >
                                <SelectTrigger className="w-[80px]" data-testid={`select-pat-result-${appliance.id}`}>
                                  <SelectValue placeholder="Result" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pass">Pass</SelectItem>
                                  <SelectItem value="fail">Fail</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removePATAppliance(appliance.id)}
                                data-testid={`button-remove-pat-${appliance.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {((certificateData as PATData).appliances || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No appliances added. Click "Add Appliance" to start.
                  </p>
                )}
              </div>
            )}

            {getSelectedTypeShortCode() === "FIRE" && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-medium">Fire Alarm System Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>System Type</Label>
                    <Select
                      value={(certificateData as FireAlarmData).systemType || ""}
                      onValueChange={(val) => updateFireAlarmData("systemType", val)}
                    >
                      <SelectTrigger data-testid="select-fire-system-type">
                        <SelectValue placeholder="Select system type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conventional">Conventional</SelectItem>
                        <SelectItem value="addressable">Addressable</SelectItem>
                        <SelectItem value="wireless">Wireless</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Battery Condition</Label>
                    <Select
                      value={(certificateData as FireAlarmData).batteryCondition || ""}
                      onValueChange={(val) => updateFireAlarmData("batteryCondition", val)}
                    >
                      <SelectTrigger data-testid="select-fire-battery">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="replace_soon">Replace Soon</SelectItem>
                        <SelectItem value="replace_now">Replace Now</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Zones</Label>
                    <Input
                      type="number"
                      value={(certificateData as FireAlarmData).numberOfZones || ""}
                      onChange={(e) => updateFireAlarmData("numberOfZones", e.target.value)}
                      placeholder="e.g., 4"
                      data-testid="input-fire-zones"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Detectors</Label>
                    <Input
                      type="number"
                      value={(certificateData as FireAlarmData).numberOfDetectors || ""}
                      onChange={(e) => updateFireAlarmData("numberOfDetectors", e.target.value)}
                      placeholder="e.g., 12"
                      data-testid="input-fire-detectors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Sounders</Label>
                    <Input
                      type="number"
                      value={(certificateData as FireAlarmData).numberOfSounders || ""}
                      onChange={(e) => updateFireAlarmData("numberOfSounders", e.target.value)}
                      placeholder="e.g., 6"
                      data-testid="input-fire-sounders"
                    />
                  </div>
                </div>
              </div>
            )}

            {getSelectedTypeShortCode() === "SMOKE" && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Smoke & CO Alarm Locations</h4>
                  <Button type="button" size="sm" onClick={addSmokeLocation} data-testid="button-add-smoke-location">
                    <Plus className="h-4 w-4 mr-1" /> Add Location
                  </Button>
                </div>
                {((certificateData as SmokeData).locations || []).map((loc, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 bg-background">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Input
                          value={loc.location}
                          onChange={(e) => updateSmokeLocation(index, "location", e.target.value)}
                          placeholder="Location name"
                          data-testid={`input-smoke-location-${index}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSmokeLocation(index)}
                        data-testid={`button-remove-smoke-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`smoke-alarm-${index}`}
                            checked={loc.hasSmokeAlarm}
                            onCheckedChange={(checked) => updateSmokeLocation(index, "hasSmokeAlarm", !!checked)}
                            data-testid={`checkbox-smoke-alarm-${index}`}
                          />
                          <Label htmlFor={`smoke-alarm-${index}`}>Smoke Alarm</Label>
                        </div>
                        {loc.hasSmokeAlarm && (
                          <Select
                            value={loc.smokeAlarmResult}
                            onValueChange={(val) => updateSmokeLocation(index, "smokeAlarmResult", val)}
                          >
                            <SelectTrigger data-testid={`select-smoke-result-${index}`}>
                              <SelectValue placeholder="Test result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass">Pass</SelectItem>
                              <SelectItem value="fail">Fail</SelectItem>
                              <SelectItem value="replaced">Replaced</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`co-alarm-${index}`}
                            checked={loc.hasCOAlarm}
                            onCheckedChange={(checked) => updateSmokeLocation(index, "hasCOAlarm", !!checked)}
                            data-testid={`checkbox-co-alarm-${index}`}
                          />
                          <Label htmlFor={`co-alarm-${index}`}>CO Alarm</Label>
                        </div>
                        {loc.hasCOAlarm && (
                          <Select
                            value={loc.coAlarmResult}
                            onValueChange={(val) => updateSmokeLocation(index, "coAlarmResult", val)}
                          >
                            <SelectTrigger data-testid={`select-co-result-${index}`}>
                              <SelectValue placeholder="Test result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass">Pass</SelectItem>
                              <SelectItem value="fail">Fail</SelectItem>
                              <SelectItem value="replaced">Replaced</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observations">Observations</Label>
              <Textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Enter any observations..."
                rows={3}
                data-testid="textarea-observations"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendations">Recommendations</Label>
              <Textarea
                id="recommendations"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Enter any recommendations..."
                rows={3}
                data-testid="textarea-recommendations"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="engineer-name">Engineer Name *</Label>
                <Input
                  id="engineer-name"
                  value={engineerName}
                  onChange={(e) => setEngineerName(e.target.value)}
                  placeholder="Enter engineer name"
                  data-testid="input-engineer-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engineer-registration">Registration Number</Label>
                <Input
                  id="engineer-registration"
                  value={engineerRegistration}
                  onChange={(e) => setEngineerRegistration(e.target.value)}
                  placeholder="Gas Safe, NICEIC, etc."
                  data-testid="input-engineer-registration"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Engineer Signature *</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    signatureRef.current?.clear();
                    setSignatureEmpty(true);
                  }}
                  data-testid="button-clear-signature"
                >
                  <Eraser className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="border rounded-lg bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    className: "w-full h-40",
                    style: { width: "100%", height: "160px" },
                  }}
                  onEnd={checkSignature}
                />
              </div>
              {signatureEmpty && (
                <p className="text-sm text-muted-foreground">Please sign above</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCertificate}
              disabled={createCertificateMutation.isPending || !selectedTypeId || !propertyAddress || !issueDate || signatureEmpty}
              data-testid="button-submit-certificate"
            >
              {createCertificateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={viewSheetOpen} onOpenChange={setViewSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between pr-8">
              <div>
                <SheetTitle>Certificate Details</SheetTitle>
                <SheetDescription>
                  View complete certificate information
                </SheetDescription>
              </div>
              <Button
                size="sm"
                onClick={handlePrintCertificate}
                data-testid="button-print-certificate"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </SheetHeader>

          {selectedCertificate && (
            <div className="space-y-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Certificate No</p>
                  <p className="text-lg font-semibold">{selectedCertificate.certificateNo}</p>
                </div>
                {getStatusBadge(selectedCertificate.status, selectedCertificate.expiryDate)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedCertificate.certificateType?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Result</p>
                  {getResultBadge(selectedCertificate.result)}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Property Address</p>
                <p className="font-medium">{selectedCertificate.propertyAddress}</p>
                {selectedCertificate.propertyPostcode && (
                  <p className="text-muted-foreground">{selectedCertificate.propertyPostcode}</p>
                )}
              </div>

              {selectedCertificate.client && (
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedCertificate.client.name}</p>
                  {selectedCertificate.client.email && (
                    <p className="text-sm text-muted-foreground">{selectedCertificate.client.email}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium">
                    {selectedCertificate.issueDate
                      ? format(new Date(selectedCertificate.issueDate), "dd/MM/yyyy")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium">
                    {selectedCertificate.expiryDate
                      ? format(new Date(selectedCertificate.expiryDate), "dd/MM/yyyy")
                      : "-"}
                  </p>
                </div>
              </div>

              {(() => {
                const certData = selectedCertificate.certificateData as Record<string, unknown> | null;
                const hasData = certData && typeof certData === 'object' && Object.keys(certData).length > 0;
                if (!hasData) return null;
                return (
                  <Accordion type="single" collapsible className="w-full" defaultValue="certificate-details">
                    <AccordionItem value="certificate-details">
                      <AccordionTrigger data-testid="accordion-certificate-details">
                        {selectedCertificate.certificateType?.shortCode} Specific Details
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {selectedCertificate.certificateType?.shortCode === "EICR" && renderEICRDetails(certData as unknown as EICRData)}
                          {selectedCertificate.certificateType?.shortCode === "CP12" && renderCP12Details(certData as unknown as CP12Data)}
                          {selectedCertificate.certificateType?.shortCode === "BOILER" && renderBoilerDetails(certData as unknown as BoilerData)}
                          {selectedCertificate.certificateType?.shortCode === "PAT" && renderPATDetails(certData as unknown as PATData)}
                          {selectedCertificate.certificateType?.shortCode === "FIRE" && renderFireAlarmDetails(certData as unknown as FireAlarmData)}
                          {selectedCertificate.certificateType?.shortCode === "SMOKE" && renderSmokeDetails(certData as unknown as SmokeData)}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                );
              })()}

              {selectedCertificate.observations && (
                <div>
                  <p className="text-sm text-muted-foreground">Observations</p>
                  <p className="font-medium whitespace-pre-wrap">{selectedCertificate.observations}</p>
                </div>
              )}

              {selectedCertificate.recommendations && (
                <div>
                  <p className="text-sm text-muted-foreground">Recommendations</p>
                  <p className="font-medium whitespace-pre-wrap">{selectedCertificate.recommendations}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Engineer Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedCertificate.engineerName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Registration</p>
                    <p className="font-medium">{selectedCertificate.engineerRegistration || "-"}</p>
                  </div>
                </div>

                {selectedCertificate.engineerSignature && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Signature</p>
                    <div className="border rounded-lg p-2 bg-white">
                      <img
                        src={selectedCertificate.engineerSignature}
                        alt="Engineer signature"
                        className="max-h-24"
                      />
                    </div>
                  </div>
                )}
              </div>

              {selectedCertificate.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{selectedCertificate.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {showPrintView && selectedCertificate && (
        <div className="print-certificate-container print-only">
          <div className="print-certificate">
            <div className="print-header">
              <div className="print-logo-section">
                <div className="print-logo-placeholder">
                  [COMPANY LOGO]
                </div>
                <div className="print-company-name">
                  Your Company Name
                </div>
              </div>
              <div className="print-title-section">
                <h1 className="print-certificate-title">
                  {getCertificateTitle(selectedCertificate.certificateType?.shortCode)}
                </h1>
                <div className="print-certificate-number">
                  Certificate No: <strong>{selectedCertificate.certificateNo}</strong>
                </div>
              </div>
            </div>

            <div className="print-result-banner" data-result={selectedCertificate.result}>
              <span className="print-result-label">Result:</span>
              <span className="print-result-value">{getResultText(selectedCertificate.result)}</span>
            </div>

            <div className="print-body">
              <div className="print-section">
                <h3 className="print-section-title">Property & Client Details</h3>
                <table className="print-table">
                  <tbody>
                    <tr>
                      <td className="label-cell">Property Address</td>
                      <td className="value-cell">
                        {selectedCertificate.propertyAddress}
                        {selectedCertificate.propertyPostcode && `, ${selectedCertificate.propertyPostcode}`}
                      </td>
                    </tr>
                    {selectedCertificate.client && (
                      <>
                        <tr>
                          <td className="label-cell">Client Name</td>
                          <td className="value-cell">{selectedCertificate.client.name}</td>
                        </tr>
                        {selectedCertificate.client.email && (
                          <tr>
                            <td className="label-cell">Email</td>
                            <td className="value-cell">{selectedCertificate.client.email}</td>
                          </tr>
                        )}
                        {selectedCertificate.client.phone && (
                          <tr>
                            <td className="label-cell">Phone</td>
                            <td className="value-cell">{selectedCertificate.client.phone}</td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <h3 className="print-section-title">Certificate Information</h3>
                <table className="print-table">
                  <tbody>
                    <tr>
                      <td className="label-cell">Issue Date</td>
                      <td className="value-cell">
                        {selectedCertificate.issueDate
                          ? format(new Date(selectedCertificate.issueDate), "dd MMMM yyyy")
                          : "-"}
                      </td>
                    </tr>
                    <tr>
                      <td className="label-cell">Expiry Date</td>
                      <td className="value-cell">
                        {selectedCertificate.expiryDate
                          ? format(new Date(selectedCertificate.expiryDate), "dd MMMM yyyy")
                          : "-"}
                      </td>
                    </tr>
                    <tr>
                      <td className="label-cell">Engineer Name</td>
                      <td className="value-cell">{selectedCertificate.engineerName || "-"}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">Registration Number</td>
                      <td className="value-cell">{selectedCertificate.engineerRegistration || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {(() => {
                const certData = selectedCertificate.certificateData as Record<string, unknown> | null;
                const hasData = certData && typeof certData === 'object' && Object.keys(certData).length > 0;
                if (!hasData) return null;
                return (
                  <div className="print-section">
                    <h3 className="print-section-title">
                      {selectedCertificate.certificateType?.shortCode} Details
                    </h3>
                    {selectedCertificate.certificateType?.shortCode === "EICR" && renderPrintEICRDetails(certData as unknown as EICRData)}
                    {selectedCertificate.certificateType?.shortCode === "CP12" && renderPrintCP12Details(certData as unknown as CP12Data)}
                    {selectedCertificate.certificateType?.shortCode === "BOILER" && renderPrintBoilerDetails(certData as unknown as BoilerData)}
                    {selectedCertificate.certificateType?.shortCode === "PAT" && renderPrintPATDetails(certData as unknown as PATData)}
                    {selectedCertificate.certificateType?.shortCode === "FIRE" && renderPrintFireAlarmDetails(certData as unknown as FireAlarmData)}
                    {selectedCertificate.certificateType?.shortCode === "SMOKE" && renderPrintSmokeDetails(certData as unknown as SmokeData)}
                  </div>
                );
              })()}

              {(selectedCertificate.observations || selectedCertificate.recommendations) && (
                <div className="print-section">
                  <h3 className="print-section-title">Observations & Recommendations</h3>
                  {selectedCertificate.observations && (
                    <div className="print-observation-block">
                      <h4 className="print-subsection-title">Observations</h4>
                      <p className="print-text">{selectedCertificate.observations}</p>
                    </div>
                  )}
                  {selectedCertificate.recommendations && (
                    <div className="print-observation-block">
                      <h4 className="print-subsection-title">Recommendations</h4>
                      <p className="print-text">{selectedCertificate.recommendations}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="print-section print-signatures">
                <h3 className="print-section-title">Signatures</h3>
                <div className="print-signature-grid">
                  <div className="print-signature-box">
                    <p className="print-signature-label">Engineer Signature</p>
                    {selectedCertificate.engineerSignature ? (
                      <img
                        src={selectedCertificate.engineerSignature}
                        alt="Engineer signature"
                        className="print-signature-img"
                      />
                    ) : (
                      <div className="print-signature-line"></div>
                    )}
                    <p className="print-signature-name">{selectedCertificate.engineerName || ""}</p>
                    <p className="print-signature-date">
                      Date: {selectedCertificate.issueDate
                        ? format(new Date(selectedCertificate.issueDate), "dd/MM/yyyy")
                        : "________________"}
                    </p>
                  </div>
                  <div className="print-signature-box">
                    <p className="print-signature-label">Client Signature</p>
                    {selectedCertificate.clientSignature ? (
                      <img
                        src={selectedCertificate.clientSignature}
                        alt="Client signature"
                        className="print-signature-img"
                      />
                    ) : (
                      <div className="print-signature-line"></div>
                    )}
                    <p className="print-signature-name">{selectedCertificate.clientName || ""}</p>
                    <p className="print-signature-date">
                      Date: {selectedCertificate.signedAt
                        ? format(new Date(selectedCertificate.signedAt), "dd/MM/yyyy")
                        : "________________"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="print-footer">
              <div className="print-declaration">
                <p className="print-declaration-text">
                  I certify that the inspection and testing of the installation detailed above has been carried out 
                  in accordance with current regulations and standards. The results are an accurate reflection 
                  of the condition of the installation at the time of inspection.
                </p>
              </div>
              <div className="print-company-footer">
                <p>[Company Name]</p>
                <p>[Company Address Line 1]</p>
                <p>[City, Postcode]</p>
                <p>Tel: [Phone Number] | Email: [Email Address]</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
