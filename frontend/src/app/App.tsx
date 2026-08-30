import { RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./routes";
import "../i18n";
import { ToastProvider } from "../contexts/ToastContext";
import { ConfirmProvider } from "../contexts/ConfirmContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Suppress findDOMNode warning globally (from react-quill library)
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('findDOMNode') || args[0].includes('ReactDOM.findDOMNode'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};

console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('findDOMNode') || args[0].includes('ReactDOM.findDOMNode'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {/* ConfirmProvider nằm trong ToastProvider: sau khi xác nhận thường có
            một toast báo kết quả, nên hộp thoại phải gọi được toast. */}
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}