import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

export const metadata = {
  title: "SurveyAnnotate",
  description: "Likert-Studie zur Bewertung von Essay-Feedback"
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
