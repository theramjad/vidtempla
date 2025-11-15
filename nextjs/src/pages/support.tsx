import Head from "next/head";
import { appConfig } from "@/config/app";

export default function Page() {
  return (
    <>
      <Head>
        <title>Support - {appConfig.name}</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center space-y-4 px-4 text-center">
        <p className="text-xl">
          You can contact us at{" "}
          <a
            className="cursor-pointer text-blue-500 hover:underline"
            href={`mailto:${appConfig.supportEmail}`}
          >
            {appConfig.supportEmail}
          </a>
        </p>
      </main>
    </>
  );
}
