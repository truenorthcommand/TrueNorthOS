import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Send, CheckCircle, XCircle, Clock, ArrowRight, Loader2 } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Quote = {
  id: string;
  quoteNo: string;
  customerName: string;
  customerEmail: string | null;
  siteAddress: string | null;
  total: number;
  status: string;
  quoteDate: string;
  expiryDate: string | null;
  createdAt: string;
};

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const res = await fetch("/api/quotes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setQuotes(data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch quotes", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case "Sent":
        return <Badge className="bg-blue-500"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
      case "Accepted":
        return <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
      case "Declined":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      case "Expired":
        return <Badge variant="outline">Expired</Badge>;
      case "Converted":
        return <Badge className="bg-purple-500"><FileText className="w-3 h-3 mr-1" />Converted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredQuotes = quotes.filter((quote) =>
    quote.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.quoteNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackPath="/" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
            <p className="text-muted-foreground">Create and manage customer quotes</p>
          </div>
        </div>
        <Button size="lg" onClick={() => setLocation("/quotes/new")} data-testid="button-new-quote">
          <Plus className="mr-2 h-5 w-5" />
          New Quote
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input
          placeholder="Search quotes..."
          className="border-none shadow-none focus-visible:ring-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-quotes"
        />
      </div>

      {filteredQuotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No quotes yet</h3>
            <p className="text-muted-foreground mb-4">Create your first quote to get started</p>
            <Button onClick={() => setLocation("/quotes/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Quote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredQuotes.map((quote) => (
            <Card
              key={quote.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`/quotes/${quote.id}`)}
              data-testid={`card-quote-${quote.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-muted-foreground">{quote.quoteNo}</span>
                      {getStatusBadge(quote.status)}
                    </div>
                    <h3 className="font-semibold text-lg">{quote.customerName}</h3>
                    {quote.siteAddress && (
                      <p className="text-sm text-muted-foreground">{quote.siteAddress}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Created: {format(new Date(quote.createdAt), "dd MMM yyyy")}
                      {quote.expiryDate && ` • Expires: ${format(new Date(quote.expiryDate), "dd MMM yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">£{quote.total.toFixed(2)}</p>
                    <ArrowRight className="w-5 h-5 text-muted-foreground ml-auto mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
