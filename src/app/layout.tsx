import type { Metadata } from "next";
import "./globals.css";
import ClickSpark from "@/components/ClickSpark";

export const metadata: Metadata = {
  title: "My Film List",
  description: "Minha lista pessoal de filmes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0a0906] text-[#f0e8dc] antialiased">
        <ClickSpark sparkColor="#c97c4a" sparkSize={10} sparkRadius={20} sparkCount={8} duration={500}>
          {children}
        </ClickSpark>
      </body>
    </html>
  );
}
