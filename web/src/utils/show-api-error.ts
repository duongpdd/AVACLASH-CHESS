import { toast } from "react-toastify";

export function showApiError(message: string) {
  toast.error(message, { toastId: message });
}
