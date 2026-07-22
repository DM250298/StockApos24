import './globals.css';

export const metadata = {
  title: 'APOS24 · Control de Stock',
  description: 'Control de stock del consultorio APOS24',
  icons: { icon: '/apos24-logo.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#035d62',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
