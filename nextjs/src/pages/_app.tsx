import RootLayout from "@/components/layout/RootLayout";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/hooks/useUser";
import { AppProps } from "next/app";
import "../styles/globals.css";
import { api } from "../utils/api";

function App({ Component, pageProps }: AppProps) {
  const { user } = useUser();

  return (
    <>
      <RootLayout>
        <div className="min-h-screen">
          <Component {...pageProps} />
          <Toaster />
        </div>
      </RootLayout>
    </>
  );
}

export default api.withTRPC(App);
