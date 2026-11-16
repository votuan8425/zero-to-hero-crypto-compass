import { getRouteApi } from "@tanstack/react-router";

const authRoute = getRouteApi("/_authenticated");

/** The signed-in user, provided by the protected layout. */
export function useUser() {
  return authRoute.useRouteContext().user;
}
