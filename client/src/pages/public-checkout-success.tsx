import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, BookOpen } from "lucide-react";

export default function PublicCheckoutSuccess() {
  return (
    <PublicLayout>
      <section className="py-20 md:py-32 px-4 bg-slate-50 min-h-[calc(100vh-8rem)]">
        <div className="max-w-lg mx-auto text-center">
          <Card data-testid="card-checkout-success">
            <CardContent className="pt-10 pb-10">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2
                  className="h-10 w-10 text-emerald-600"
                  data-testid="icon-success-check"
                />
              </div>

              <h1
                className="text-3xl font-bold tracking-tight mb-3"
                data-testid="text-success-heading"
              >
                Welcome to TrueNorth OS!
              </h1>

              <p
                className="text-muted-foreground mb-8"
                data-testid="text-success-message"
              >
                Your account has been created and your plan is now active.
              </p>

              <Link href="/app">
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  data-testid="button-go-to-dashboard"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <div className="border-t mt-8 pt-6">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Need help getting started?
                  </span>
                </div>
                <Link href="/setup">
                  <span
                    className="text-sm text-primary hover:underline cursor-pointer"
                    data-testid="link-setup-guide"
                  >
                    Follow our setup guide to get up and running
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
}
