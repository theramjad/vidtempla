import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/dashboard/youtube/",
      permanent: false,
    },
  };
};

export default function Dashboard() {
  return <div>Dashboard</div>;
}
