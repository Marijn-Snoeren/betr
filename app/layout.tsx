import './globals.css';

export const metadata = {
  title: 'Marijn Bets',
  description: 'AI Football Predictions & Odds',
  manifest: '/manifest.json',
  themeColor: '#030712',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="bg-[#030712] text-white font-[Figtree] antialiased">{children}</body>
    </html>
  );
}