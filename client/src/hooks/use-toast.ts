import { type ToastActionElement, type ToastProps } from "@/components/ui/toast";
import { useToast as useToastUI, toast as toastUI } from "@/components/ui/use-toast";

// Create our own ToastOptions type that includes description
type ToastOptions = Partial<
  Omit<ToastProps, "id"> & {
    action?: ToastActionElement;
    description?: React.ReactNode;
  }
>;

export function useToast() {
  const { toast, ...rest } = useToastUI();

  function showToast(props: ToastOptions) {
    return toast(props);
  }

  return {
    toast: showToast,
    ...rest,
  };
}

export const toast = toastUI;