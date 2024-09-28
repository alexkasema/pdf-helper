import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";
import React from "react";

const DashboardPage = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  //! made sure a user is logged in
  if (!user || !user.id) redirect("/auth-callback?origin=dashboard");

  const dbUser = await db.user.findFirst({ where: { userId: user.id } });

  //! made sure user is in database
  if (!dbUser) redirect("/auth-callback?origin=dashboard");

  return <div>{user.email}</div>;
};

export default DashboardPage;
