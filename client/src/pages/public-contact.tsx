import { useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  Send,
} from "lucide-react";

export default function PublicContact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setSubmitted(true);
    } catch {
      // silently handle
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <PublicLayout>
      <section
        className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-16 md:py-20 px-4"
        data-testid="section-contact-hero"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
            data-testid="text-contact-heading"
          >
            Get in Touch
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Have a question, need a demo, or want to learn how TrueNorth OS can
            help your trade business? We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4" data-testid="section-contact-form">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-2xl font-bold mb-6">Send Us a Message</h2>
            {submitted ? (
              <Card data-testid="card-contact-success">
                <CardContent className="pt-6 text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Send className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
                  <p className="text-muted-foreground">
                    Thanks for reaching out. We'll get back to you within 24
                    hours.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input
                      id="company"
                      name="company"
                      placeholder="Your company name"
                      value={formData.company}
                      onChange={handleChange}
                      data-testid="input-company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+44 ..."
                      value={formData.phone}
                      onChange={handleChange}
                      data-testid="input-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="How can we help?"
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    required
                    data-testid="input-message"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={submitting}
                  data-testid="button-submit-contact"
                >
                  {submitting ? "Sending..." : "Send Message"}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold mb-6">Contact Information</h2>

            <Card data-testid="card-contact-email">
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Email</h3>
                  <a
                    href="mailto:hello@truenorthos.com"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    data-testid="link-email"
                  >
                    hello@truenorthos.com
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-contact-phone">
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Phone</h3>
                  <a
                    href="tel:+4408001234567"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    data-testid="link-phone"
                  >
                    +44 0800 123 4567
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-contact-address">
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Address</h3>
                  <p className="text-sm text-muted-foreground">
                    Manchester, UK
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50" data-testid="card-prefer-chat">
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Prefer to Chat?</h3>
                  <p className="text-sm text-muted-foreground">
                    Once you're signed up, our AI assistant is available 24/7
                    inside the platform to answer questions and help you get the
                    most out of TrueNorth OS.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
