import './globals.css';

export const metadata = {
  title: 'Stock — Consultorio Odontológico',
  description: 'Control de stock del consultorio',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0e7c86',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦷</text></svg>"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
