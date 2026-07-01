export const metadata = {
  title: "Banking Transactions API",
  description: "A REST API for banking transactions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
