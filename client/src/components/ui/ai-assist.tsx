import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Wand2, Loader2, Check, X, Mic, MicOff, Volume2, SpellCheck, FileText, Sparkles, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AssistMode = 'fix' | 'simplify' | 'expand' | 'professional';

interface UseAIAssistOptions {
  onTextChange: (text: string) => void;
  getText: () => string;
  context?: string;
}

function useAIAssist({ onTextChange, getText, context }: UseAIAssistOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string>('');
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);

  const assist = async (mode: AssistMode) => {
    const text = getText();
    if (!text.trim()) {
      toast({ title: "No text to improve", description: "Please enter some text first", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setOriginalText(text);

    try {
      const response = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text, mode, context }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get suggestion');
      }

      const data = await response.json();
      setSuggestion(data.result);
    } catch (error: any) {
      toast({ title: "AI Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion) {
      onTextChange(suggestion);
      setSuggestion(null);
      setOriginalText('');
      toast({ title: "Text updated", description: "AI suggestion applied" });
    }
  };

  const rejectSuggestion = () => {
    setSuggestion(null);
    setOriginalText('');
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({ title: "Not supported", description: "Voice input is not supported in this browser", variant: "destructive" });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-GB';

    recognitionRef.current.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const currentText = getText();
      onTextChange(currentText ? currentText + ' ' + transcript : transcript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast({ title: "Voice error", description: "Could not recognize speech", variant: "destructive" });
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);
    toast({ title: "Listening...", description: "Speak now - your words will appear in the text box" });
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakText = () => {
    const text = getText();
    if (!text.trim()) {
      toast({ title: "No text to read", description: "Please enter some text first", variant: "destructive" });
      return;
    }

    if (!('speechSynthesis' in window)) {
      toast({ title: "Not supported", description: "Text-to-speech is not supported in this browser", variant: "destructive" });
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    toast({ title: "Reading aloud", description: "Tap anywhere to stop" });
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    isLoading,
    isListening,
    suggestion,
    originalText,
    assist,
    applySuggestion,
    rejectSuggestion,
    startListening,
    stopListening,
    speakText,
  };
}

interface AIAssistButtonProps {
  getText: () => string;
  onTextChange: (text: string) => void;
  context?: string;
  disabled?: boolean;
  className?: string;
}

export function AIAssistButton({ getText, onTextChange, context, disabled, className }: AIAssistButtonProps) {
  const [open, setOpen] = useState(false);
  const {
    isLoading,
    isListening,
    suggestion,
    originalText,
    assist,
    applySuggestion,
    rejectSuggestion,
    startListening,
    stopListening,
    speakText,
  } = useAIAssist({ getText, onTextChange, context });

  const handleAssist = async (mode: AssistMode) => {
    await assist(mode);
  };

  if (suggestion) {
    return (
      <div className="absolute right-1 top-1 z-10 flex items-center gap-1 bg-background border rounded-md p-1 shadow-lg">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={applySuggestion}
          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
          data-testid="ai-accept-suggestion"
        >
          <Check className="h-4 w-4 mr-1" />
          Use
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={rejectSuggestion}
          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          data-testid="ai-reject-suggestion"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || isLoading}
          className={cn(
            "absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground hover:text-primary z-10",
            className
          )}
          data-testid="ai-assist-button"
          aria-label="AI Writing Assistant"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 pb-1">AI Writing Help</p>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-sm h-9"
            onClick={() => { handleAssist('fix'); setOpen(false); }}
            disabled={isLoading}
            data-testid="ai-fix-spelling"
          >
            <SpellCheck className="h-4 w-4 mr-2 text-blue-500" />
            Fix Spelling & Grammar
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-sm h-9"
            onClick={() => { handleAssist('simplify'); setOpen(false); }}
            disabled={isLoading}
            data-testid="ai-simplify"
          >
            <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
            Make Simpler
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-sm h-9"
            onClick={() => { handleAssist('expand'); setOpen(false); }}
            disabled={isLoading}
            data-testid="ai-expand"
          >
            <FileText className="h-4 w-4 mr-2 text-green-500" />
            Expand Notes
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-sm h-9"
            onClick={() => { handleAssist('professional'); setOpen(false); }}
            disabled={isLoading}
            data-testid="ai-professional"
          >
            <Briefcase className="h-4 w-4 mr-2 text-orange-500" />
            Make Professional
          </Button>
          
          <div className="border-t my-1" />
          
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-sm h-9"
            onClick={() => { isListening ? stopListening() : startListening(); setOpen(false); }}
            data-testid="ai-voice-input"
          >
            {isListening ? (
              <>
                <MicOff className="h-4 w-4 mr-2 text-red-500" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2 text-red-500" />
                Voice Input
              </>
            )}
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-sm h-9"
            onClick={() => { speakText(); setOpen(false); }}
            data-testid="ai-read-aloud"
          >
            <Volume2 className="h-4 w-4 mr-2 text-teal-500" />
            Read Aloud
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface AITextareaProps extends React.ComponentProps<"textarea"> {
  aiContext?: string;
  showAI?: boolean;
}

export const AITextarea = React.forwardRef<HTMLTextAreaElement, AITextareaProps>(
  ({ className, aiContext, showAI = true, onChange, value, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(value?.toString() || '');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value.toString());
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
    };

    const handleAIChange = (newText: string) => {
      setInternalValue(newText);
      if (textareaRef.current) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(textareaRef.current, newText);
        const event = new Event('input', { bubbles: true });
        textareaRef.current.dispatchEvent(event);
      }
    };

    return (
      <div className="relative">
        <textarea
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={(node) => {
            textareaRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          value={internalValue}
          onChange={handleChange}
          {...props}
        />
        {showAI && (
          <AIAssistButton
            getText={() => internalValue}
            onTextChange={handleAIChange}
            context={aiContext}
            disabled={props.disabled}
          />
        )}
      </div>
    );
  }
);
AITextarea.displayName = "AITextarea";

interface AIInputProps extends React.ComponentProps<"input"> {
  aiContext?: string;
  showAI?: boolean;
}

export const AIInput = React.forwardRef<HTMLInputElement, AIInputProps>(
  ({ className, type, aiContext, showAI = true, onChange, value, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(value?.toString() || '');
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value.toString());
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
    };

    const handleAIChange = (newText: string) => {
      setInternalValue(newText);
      if (inputRef.current) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(inputRef.current, newText);
        const event = new Event('input', { bubbles: true });
        inputRef.current.dispatchEvent(event);
      }
    };

    const shouldShowAI = showAI && type !== 'password' && type !== 'email' && type !== 'number' && type !== 'tel';

    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            shouldShowAI && "pr-10",
            className
          )}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          value={internalValue}
          onChange={handleChange}
          {...props}
        />
        {shouldShowAI && (
          <AIAssistButton
            getText={() => internalValue}
            onTextChange={handleAIChange}
            context={aiContext}
            disabled={props.disabled}
            className="top-1/2 -translate-y-1/2"
          />
        )}
      </div>
    );
  }
);
AIInput.displayName = "AIInput";
