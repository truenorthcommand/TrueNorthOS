import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, FileText, Loader2, AlertTriangle } from 'lucide-react';

export default function QuoteAccept() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionComplete, setActionComplete] = useState<'accepted' | 'rejected' | null>(null);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote-accept', token],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/accept/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load quote');
      }
      return res.json();
    },
    enabled: !!token
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/quotes/accept/${token}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to accept quote');
      }
      return res.json();
    },
    onSuccess: () => setActionComplete('accepted'),
    onError: (error: Error) => {
      toast({
        title: 'Error accepting quote',
        description: error.message || 'Failed to accept quote. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/quotes/reject/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit feedback');
      }
      return res.json();
    },
    onSuccess: () => setActionComplete('rejected'),
    onError: (error: Error) => {
      toast({
        title: 'Error submitting feedback',
        description: error.message || 'Failed to submit feedback. Please try again.',
        variant: 'destructive'
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to Load Quote</h2>
            <p className="text-slate-600">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already actioned
  if (quote?.already_actioned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <CheckCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Already Responded</h2>
            <p className="text-slate-600">{quote.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Action complete
  if (actionComplete === 'accepted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Quote Accepted!</h2>
            <p className="text-slate-600 mb-4">Thank you for accepting the quote. We'll be in touch shortly to schedule the work.</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm">A confirmation has been sent. Our team will contact you within 1 business day.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (actionComplete === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <FileText className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Feedback Submitted</h2>
            <p className="text-slate-600 mb-4">Thank you for your feedback. We'll review your comments and get back to you with a revised quote.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lineItems = Array.isArray(quote?.lineItems) ? quote.lineItems : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Your Quote is Ready</h1>
          <p className="text-slate-600 mt-2">Review the details below and let us know how you'd like to proceed.</p>
        </div>

        {/* Quote Summary Card */}
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Quote #{quote?.quoteNo}</CardTitle>
              <span className="text-sm opacity-90 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Valid until {quote?.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <p className="text-blue-100 text-sm mt-1">For: {quote?.customerName}</p>
          </CardHeader>
          <CardContent className="p-6">
            {/* Line Items */}
            {lineItems.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-slate-900 mb-3">Work Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 font-medium text-slate-600">Description</th>
                        <th className="text-right p-3 font-medium text-slate-600">Qty</th>
                        <th className="text-right p-3 font-medium text-slate-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="p-3 text-slate-900">{item.description || item.name || 'Item'}</td>
                          <td className="p-3 text-right text-slate-600">{item.quantity || 1}</td>
                          <td className="p-3 text-right text-slate-900 font-medium">
                            £{Number(item.amount || item.total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              {quote?.subtotal && quote?.vat && Number(quote.vat) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="text-slate-900">£{Number(quote.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">VAT</span>
                    <span className="text-slate-900">£{Number(quote.vat).toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2"></div>
                </>
              )}
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900 text-lg">Total</span>
                <span className="font-bold text-2xl text-blue-700">£{Number(quote?.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            {quote?.notes && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium text-amber-900 text-sm mb-1">Notes</h4>
                <p className="text-amber-800 text-sm">{quote.notes}</p>
              </div>
            )}

            {/* Terms */}
            {quote?.termsAndConditions && (
              <div className="mt-4">
                <details className="group">
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 font-medium">
                    View Terms & Conditions
                  </summary>
                  <div className="mt-2 p-3 bg-slate-50 rounded text-xs text-slate-600 whitespace-pre-wrap">
                    {quote.termsAndConditions}
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!showRejectForm ? (
          <div className="space-y-3">
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full py-6 text-lg font-semibold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200"
              size="lg"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-5 w-5 mr-2" />
              )}
              Accept Quote
            </Button>
            <Button
              onClick={() => setShowRejectForm(true)}
              variant="outline"
              className="w-full py-5 text-base border-red-200 text-red-700 hover:bg-red-50"
              size="lg"
            >
              <XCircle className="h-5 w-5 mr-2" />
              Request Changes
            </Button>
          </div>
        ) : (
          <Card className="border-orange-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-3">What changes would you like?</h3>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Please describe what you'd like us to change or any questions you have..."
                className="min-h-[120px] mb-4"
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Submit Feedback
                </Button>
                <Button
                  onClick={() => setShowRejectForm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error display */}
        {(acceptMutation.error || rejectMutation.error) && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              {(acceptMutation.error as Error)?.message || (rejectMutation.error as Error)?.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
