import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/admin",
      permanent: false,
    },
  };
};

export default function Home() {
  return <div>Redirecting to dashboard...</div>;
}
