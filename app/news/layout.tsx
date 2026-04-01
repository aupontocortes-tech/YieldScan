import { NewsHubHeader } from '@/components/dashboard/news-hub-header'

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <NewsHubHeader />
        {children}
      </main>
    </div>
  )
}
