import { ReactNode } from "react";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

interface LegalLayoutProps {
  children: ReactNode;
  title: string;
  lastUpdated: string;
}

export function LegalLayout({ children, title, lastUpdated }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="bg-card border rounded-lg shadow-sm p-8 md:p-12">
              <h1 className="text-4xl font-bold mb-2">{title}</h1>
              <p className="text-sm text-muted-foreground mb-8">
                Last Updated: {lastUpdated}
              </p>
              <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-2xl prose-h3:mt-6 prose-h3:mb-3 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-p:text-base prose-p:leading-7">
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
