import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Keep wallet markup stable during server rendering and hydration. */
export function useClientMounted() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
