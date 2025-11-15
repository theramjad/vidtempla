import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/admin/twitter/",
      permanent: false,
    },
  };
};

export default function Dashboard() {
  return <div>Dashboard</div>;
}
