import { toNextJsHandler } from "better-auth/next-js";
import { getCustomerAuth } from "@/lib/customer-auth";

export const { GET, POST } = toNextJsHandler((request: Request) => getCustomerAuth().handler(request));
