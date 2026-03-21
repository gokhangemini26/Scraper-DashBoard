import SessionHistory from '@/components/SessionHistory';
import UrlInputForm from '@/components/UrlInputForm';
import CategoryTree from '@/components/CategoryTree';
import StatsBar from '@/components/StatsBar';
import LiveLogPanel from '@/components/LiveLogPanel';
import ProductsTable from '@/components/ProductsTable';
import { Bot } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-80 border-r border-border/40 p-4 h-screen hidden lg:block flex-shrink-0 bg-muted/10">
        <SessionHistory />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
        <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
          
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/20 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                <Bot size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">
                  SmartScraper <span className="text-primary opacity-90">Dashboard</span>
                </h1>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Input & Tree Section - 5 columns wide on huge screens */}
            <div className="xl:col-span-5 space-y-6">
              <UrlInputForm />
              <CategoryTree />
            </div>

            {/* Live Progress Section - 7 columns wide */}
            <div className="xl:col-span-7 space-y-6">
              <StatsBar />
              <LiveLogPanel />
            </div>
          </div>

          {/* Bottom Table Section */}
          <div className="pt-4 mt-8">
            <ProductsTable />
          </div>

        </div>
      </main>
    </div>
  );
}
