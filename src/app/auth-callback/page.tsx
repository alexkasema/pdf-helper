import { Suspense } from "react";
import AuthCallback from "./AuthCallback";

const AuthCallbackPage = () => {
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  );
};

export default AuthCallbackPage;
