import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search, X, Briefcase, Users, FileText, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchResults {
  jobs: any[];
  clients: any[];
  quotes: any[];
}

export function GlobalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch { /* ignore */ }
      setIsLoading(false);
    }, 300);
  }, [query]);

  const handleSelect = (path: string) => {
    navigate(path);
    setQuery('');
    setResults(null);
    setIsOpen(false);
  };

  const totalResults = results ? results.jobs.length + results.clients.length + results.quotes.length : 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search jobs, clients, addresses... (Ctrl+K)"
          className="pl-9 pr-8 h-9 bg-muted/50 border-muted text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults(null); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : totalResults === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          ) : (
            <div className="py-1">
              {/* Jobs */}
              {results!.jobs.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jobs</div>
                  {results!.jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => handleSelect(`/jobs/${job.id}`)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3"
                    >
                      <Briefcase className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{job.customer_name} <span className="text-muted-foreground">#{job.job_no}</span></div>
                        {job.address && <div className="text-xs text-muted-foreground truncate">{job.address}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Clients */}
              {results!.clients.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t">Clients</div>
                  {results!.clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelect(`/clients/${client.id}`)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3"
                    >
                      <Users className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{client.name}</div>
                        {client.email && <div className="text-xs text-muted-foreground truncate">{client.email}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Quotes */}
              {results!.quotes.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t">Quotes</div>
                  {results!.quotes.map((quote) => (
                    <button
                      key={quote.id}
                      onClick={() => handleSelect(`/quotes/${quote.id}`)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3"
                    >
                      <FileText className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{quote.customer_name} <span className="text-muted-foreground">{quote.quote_no}</span></div>
                        {quote.site_address && <div className="text-xs text-muted-foreground truncate">{quote.site_address}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
