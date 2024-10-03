import BillingForm from "@/components/BillingForm";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import React from "react";

const DashboardBillingPage = async () => {
  const subscriptionPlan = await getUserSubscriptionPlan();
  // Check if subscriptionPlan is null or undefined and handle accordingly
  if (!subscriptionPlan) {
    return <p>Error: No subscription plan found. Please try again later.</p>;
  }
  return <BillingForm subscriptionPlan={subscriptionPlan} />;
};

export default DashboardBillingPage;
