
'use client';

import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import Header from '@/components/layout/header';
import { usePathname } from 'next/navigation';

// export const metadata: Metadata = {
//   title: 'MediScan AI',
//   description: 'AI-Powered Skin Condition Analysis',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isDoctorRoute = pathname.startsWith('/doctor');
  const isPatientRoute = pathname.startsWith('/patient');
  const isLandingPage = pathname === '/';
  
  const showHeader = !isDoctorRoute && !isPatientRoute && !isLandingPage;

  let bodyClassName = 'font-sans antialiased min-h-screen bg-background';
  if (isLandingPage) {
    bodyClassName += ' landing-body';
  } else if (isPatientRoute) {
    bodyClassName += ' new-dashboard-bg';
  } else {
    bodyClassName += ' bg-gradient-subtle';
  }


  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>MediScan AI</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn(bodyClassName)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <div className={cn("flex flex-col min-h-screen", {"bg-transparent": isDoctorRoute})}>
            {showHeader && <Header />}
            <main className={cn("flex-1", {"pt-24": showHeader && !isLandingPage})}>{children}</main>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

    