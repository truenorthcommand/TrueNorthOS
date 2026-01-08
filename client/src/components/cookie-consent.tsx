import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cookie, X } from "lucide-react";
import { Link } from "wouter";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: true
    }));
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({
      accepted: false,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: false
    }));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm border-t">
      <Card className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Cookie Preferences</h3>
              <p className="text-sm text-muted-foreground">
                We use cookies to improve your experience. Essential cookies are required for the app to function. 
                Analytics cookies help us improve our service.{" "}
                <Link href="/privacy" className="text-primary underline">
                  Learn more
                </Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDecline}
              className="flex-1 md:flex-none"
              data-testid="button-decline-cookies"
            >
              Essential Only
            </Button>
            <Button 
              size="sm" 
              onClick={handleAccept}
              className="flex-1 md:flex-none"
              data-testid="button-accept-cookies"
            >
              Accept All
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
