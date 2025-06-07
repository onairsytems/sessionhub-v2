'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ArrowRight, Zap, Code2, Users, GitBranch } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: Code2,
    title: 'Two-Actor Model',
    description: 'Perfect separation between planning and execution for zero-error development.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Achieve unprecedented development velocity through systematic execution.',
  },
  {
    icon: GitBranch,
    title: 'Version Control',
    description: 'Every session tracked, versioned, and validated automatically.',
  },
  {
    icon: Users,
    title: 'AI-Powered',
    description: 'Leverage Claude Chat for planning and Claude Code for implementation.',
  },
];

export default function HomePage() {
  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="block bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent animate-slide-in">
                Development Velocity
              </span>
              <span className="block text-gray-900 dark:text-white mt-2">
                Through Perfect Execution
              </span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto animate-slide-in animation-delay-100">
              SessionHub revolutionizes software development with the Two-Actor Model. 
              Plan with intelligence. Execute with precision. Ship with confidence.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-bounce-in animation-delay-200">
              <Button size="lg" className="group">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="secondary">
                View Documentation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Built for Speed & Precision
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Every feature designed to maximize your development velocity.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                hover
                className={`animate-slide-in animation-delay-${index * 100}`}
              >
                <CardHeader className="pb-3">
                  <feature.icon className="h-10 w-10 text-primary-600 dark:text-primary-400 mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Development?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join the revolution. Build faster. Ship better. Zero errors.
          </p>
          <Link href="/sessions">
            <Button size="lg" variant="secondary" className="group">
              Start Your First Session
              <Zap className="ml-2 h-5 w-5 animate-pulse" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}