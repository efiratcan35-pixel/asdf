import './globals.css';
import { AuthProvider } from '@/lib/auth';
import SupportFooter from '@/components/SupportFooter';

export const metadata = {
  title: 'Portal',
  description: '3D Configurator + Yatırımcı/Yüklenici Portalı',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AuthProvider>
          {children}
          <SupportFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
