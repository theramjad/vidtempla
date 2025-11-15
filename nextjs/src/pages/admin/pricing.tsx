/**
 * Pricing Page
 * Subscription tiers and pricing information
 */

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out YTDM',
    features: [
      'Up to 5 videos',
      'Basic template management',
      'Manual description updates',
      'Community support',
    ],
    limitations: [
      'Limited to 5 videos',
      'Single channel only',
    ],
    buttonText: 'Current Plan',
    buttonVariant: 'outline' as const,
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '$20',
    period: 'per month',
    description: 'For content creators managing one channel',
    features: [
      'Unlimited videos',
      '1 YouTube channel',
      'Advanced template system',
      'Automatic description updates',
      'Version history & rollback',
      'Priority support',
    ],
    buttonText: 'Upgrade to Premium',
    buttonVariant: 'default' as const,
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$100',
    period: 'per month',
    description: 'For agencies and businesses with multiple channels',
    features: [
      'Everything in Premium',
      'Unlimited YouTube channels',
      'Team collaboration',
      'Bulk operations',
      'API access',
      'Dedicated support',
      'Custom integrations',
    ],
    buttonText: 'Upgrade to Business',
    buttonVariant: 'default' as const,
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Pricing Plans</h1>
          <p className="text-muted-foreground mt-2">
            Choose the plan that best fits your needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative ${
                tier.highlighted
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-border'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground ml-2">/ {tier.period}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.limitations && tier.limitations.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Limitations:
                    </p>
                    <ul className="space-y-1">
                      {tier.limitations.map((limitation, index) => (
                        <li key={index} className="text-xs text-muted-foreground">
                          • {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={tier.buttonVariant}
                  size="lg"
                  disabled={tier.name === 'Free'}
                >
                  {tier.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Need a Custom Plan?</CardTitle>
              <CardDescription>
                Contact us for enterprise solutions and custom pricing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                For organizations with specific needs, we offer custom plans with tailored features,
                dedicated support, and flexible pricing.
              </p>
              <Button variant="outline">Contact Sales</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
