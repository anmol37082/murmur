import { redirect } from "next/navigation";
import { userId } from "@/lib/auth"; import Messenger from "@/components/Messenger";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await userId())) redirect("/login");
  return <Messenger socketUrl={process.env.SOCKET_SERVER_URL!} />;
}
