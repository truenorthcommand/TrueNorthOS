import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  Camera, 
  FileText, 
  MapPin, 
  PenTool, 
  ClipboardList,
  AlertCircle,
  ArrowRight,
  Lock
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  required: boolean;
  icon: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

interface JobChecklistProps {
  job: {
    id: string;
    jobNo: string;
    status: string;
    description?: string | null;
    worksCompleted?: string | null;
    photos?: Array<{ source?: string }>;
    signatures?: Array<{ type: string }>;
    signOffLat?: number | null;
    signOffAddress?: string | null;
  };
  requiredForms?: Array<{
    id: string;
    name: string;
    completed: boolean;
  }>;
  onNavigateToPhotos?: () => void;
  onNavigateToForms?: () => void;
  className?: string;
}

export function JobChecklist({ 
  job, 
  requiredForms = [], 
  onNavigateToPhotos,
  onNavigateToForms,
  className 
}: JobChecklistProps) {
  const hasDescription = !!(job.description && job.description.trim().length > 0);
  const hasWorksCompleted = !!(job.worksCompleted && job.worksCompleted.trim().length > 0);
  const evidencePhotos = (job.photos || []).filter(p => !p.source || p.source === 'engineer');
  const hasPhotos = evidencePhotos.length > 0;
  const hasEngineerSignature = (job.signatures || []).some(s => s.type === 'engineer');
  const hasCustomerSignature = (job.signatures || []).some(s => s.type === 'customer');
  const hasLocation = !!(job.signOffLat || job.signOffAddress);
  const allFormsCompleted = requiredForms.length === 0 || requiredForms.every(f => f.completed);
  const completedFormCount = requiredForms.filter(f => f.completed).length;

  const checklistItems: ChecklistItem[] = [
    {
      id: 'description',
      label: 'Description of Works',
      description: 'Describe the work to be carried out',
      completed: hasDescription,
      required: true,
      icon: <FileText className="h-4 w-4" />,
      action: {
        label: 'Edit job details',
        href: `/jobs/${job.id}#description`,
      },
    },
    {
      id: 'works-completed',
      label: 'Works Completed',
      description: 'Document what work was completed',
      completed: hasWorksCompleted,
      required: true,
      icon: <ClipboardList className="h-4 w-4" />,
      action: {
        label: 'Edit job details',
        href: `/jobs/${job.id}#works`,
      },
    },
    {
      id: 'photos',
      label: 'Evidence Photos',
      description: evidencePhotos.length > 0 
        ? `${evidencePhotos.length} photo${evidencePhotos.length !== 1 ? 's' : ''} uploaded` 
        : 'Upload at least one evidence photo',
      completed: hasPhotos,
      required: true,
      icon: <Camera className="h-4 w-4" />,
      action: onNavigateToPhotos ? {
        label: 'Upload photos',
        onClick: onNavigateToPhotos,
      } : undefined,
    },
    ...(requiredForms.length > 0 ? [{
      id: 'forms',
      label: 'Required Forms',
      description: allFormsCompleted 
        ? `${requiredForms.length} form${requiredForms.length !== 1 ? 's' : ''} completed`
        : `${completedFormCount}/${requiredForms.length} forms completed`,
      completed: allFormsCompleted,
      required: true,
      icon: <ClipboardList className="h-4 w-4" />,
      action: onNavigateToForms ? {
        label: 'View forms',
        onClick: onNavigateToForms,
      } : undefined,
    }] : []),
    {
      id: 'location',
      label: 'Location Capture',
      description: hasLocation ? 'Location captured' : 'Captured during sign-off',
      completed: hasLocation,
      required: true,
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      id: 'engineer-signature',
      label: 'Engineer Signature',
      description: hasEngineerSignature ? 'Signature captured' : 'Required during sign-off',
      completed: hasEngineerSignature,
      required: true,
      icon: <PenTool className="h-4 w-4" />,
    },
    {
      id: 'customer-signature',
      label: 'Customer Signature',
      description: hasCustomerSignature ? 'Signature captured' : 'Required during sign-off',
      completed: hasCustomerSignature,
      required: true,
      icon: <PenTool className="h-4 w-4" />,
    },
  ];

  const preSignOffItems = checklistItems.filter(item => 
    ['description', 'works-completed', 'photos', 'forms'].includes(item.id)
  );
  const preSignOffCompleted = preSignOffItems.every(item => item.completed);
  
  const signOffItems = checklistItems.filter(item => 
    ['location', 'engineer-signature', 'customer-signature'].includes(item.id)
  );

  // Progress only counts pre-sign-off items (signatures/location are captured during sign-off)
  const preSignOffCompletedCount = preSignOffItems.filter(item => item.completed).length;
  const progressPercent = preSignOffItems.length > 0 
    ? (preSignOffCompletedCount / preSignOffItems.length) * 100 
    : 100;

  // Determine next action
  const getNextAction = () => {
    const incompletePreSignOff = preSignOffItems.find(item => !item.completed);
    if (incompletePreSignOff) {
      return {
        label: incompletePreSignOff.label,
        description: `Complete ${incompletePreSignOff.label.toLowerCase()} to continue`,
        action: incompletePreSignOff.action,
        canProceedToSignOff: false,
      };
    }
    return {
      label: 'Ready for Sign-off',
      description: 'All pre-requisites complete. Proceed to sign-off.',
      canProceedToSignOff: true,
    };
  };

  const nextAction = getNextAction();
  const isSignedOff = job.status === 'Signed Off';

  if (isSignedOff) {
    return (
      <Card className={cn("border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30", className)} data-testid="card-job-complete">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">Job Complete</h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                This job has been signed off and completed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="card-job-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Close Job Checklist</CardTitle>
            <CardDescription>
              Complete these items before signing off
            </CardDescription>
          </div>
          <Badge 
            variant={progressPercent === 100 ? "default" : "secondary"}
            className={progressPercent === 100 ? "bg-green-600" : ""}
          >
            {preSignOffCompletedCount}/{preSignOffItems.length} complete
          </Badge>
        </div>
        <Progress value={progressPercent} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next Action Banner */}
        <div 
          className={cn(
            "rounded-lg p-4 border",
            nextAction.canProceedToSignOff 
              ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
              : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
          )}
          data-testid="banner-next-action"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {nextAction.canProceedToSignOff ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <h4 className="font-medium text-sm">
                  {nextAction.canProceedToSignOff ? 'Ready for Sign-off' : 'Next: ' + nextAction.label}
                </h4>
                <p className="text-xs text-muted-foreground">{nextAction.description}</p>
              </div>
            </div>
            {nextAction.canProceedToSignOff ? (
              <Link href={`/jobs/${job.id}/sign-off`}>
                <Button size="sm" data-testid="button-go-signoff">
                  Sign Off
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            ) : nextAction.action?.href ? (
              <Link href={nextAction.action.href}>
                <Button size="sm" variant="outline" data-testid="button-next-action">
                  {nextAction.action.label}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            ) : nextAction.action?.onClick ? (
              <Button size="sm" variant="outline" onClick={nextAction.action.onClick} data-testid="button-next-action">
                {nextAction.action.label}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Pre-sign-off items */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Before Sign-off</h4>
          {preSignOffItems.map((item) => (
            <div 
              key={item.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                item.completed 
                  ? "bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900" 
                  : "bg-background"
              )}
              data-testid={`checklist-item-${item.id}`}
            >
              <div className="flex items-center gap-3">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      item.completed && "text-green-700 dark:text-green-300"
                    )}>
                      {item.label}
                    </span>
                    {item.required && !item.completed && (
                      <Badge variant="outline" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {!item.completed && item.action && (
                item.action.href ? (
                  <Link href={item.action.href}>
                    <Button size="sm" variant="ghost" data-testid={`button-action-${item.id}`}>
                      {item.action.label}
                    </Button>
                  </Link>
                ) : item.action.onClick ? (
                  <Button size="sm" variant="ghost" onClick={item.action.onClick} data-testid={`button-action-${item.id}`}>
                    {item.action.label}
                  </Button>
                ) : null
              )}
            </div>
          ))}
        </div>

        {/* Sign-off items */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Lock className="h-3 w-3" />
            During Sign-off
          </h4>
          {signOffItems.map((item) => (
            <div 
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                item.completed 
                  ? "bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900" 
                  : "bg-muted/30"
              )}
              data-testid={`checklist-item-${item.id}`}
            >
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/50" />
              )}
              <div>
                <span className={cn(
                  "text-sm",
                  item.completed 
                    ? "font-medium text-green-700 dark:text-green-300" 
                    : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Required Forms List (if any) */}
        {requiredForms.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Required Forms</h4>
            {requiredForms.map((form) => (
              <div 
                key={form.id}
                className="flex items-center justify-between p-2 rounded border bg-muted/20"
                data-testid={`form-item-${form.id}`}
              >
                <div className="flex items-center gap-2">
                  {form.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">{form.name}</span>
                </div>
                {!form.completed && (
                  <Link href={`/forms/fill?templateId=${form.id}&entityType=job&entityId=${job.id}`}>
                    <Button size="sm" variant="ghost" data-testid={`button-fill-form-${form.id}`}>
                      Fill Form
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
