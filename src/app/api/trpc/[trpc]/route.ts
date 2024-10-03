import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/trpc";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();
      return { user: user || null };
    },
  });

export { handler as GET, handler as POST };
