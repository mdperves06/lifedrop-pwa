"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fieldErrors, type ApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/client/toast";

/**
 * Mutation helper: prevents duplicate submissions, surfaces loading / success /
 * failure feedback, and refreshes server components on success.
 */
export function useAction<T = unknown>() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiFailure | null>(null);
  const inflight = useRef(false);
  const toast = useToast();
  const router = useRouter();

  const run = useCallback(
    async (
      url: string,
      opts: { method?: string; body?: unknown; success?: string; refresh?: boolean; silent?: boolean; onSuccess?: (data: T) => void; onError?: (e: ApiFailure) => void } = {},
    ) => {
      if (inflight.current) return null;
      inflight.current = true;
      setPending(true);
      setErrors({});
      setError(null);
      const res = await api<T>(url, { method: opts.method, body: opts.body });
      inflight.current = false;
      setPending(false);
      if (!res.ok) {
        setErrors(fieldErrors(res));
        setError(res);
        if (!opts.silent) toast("error", res.message);
        opts.onError?.(res);
        return null;
      }
      if (opts.success) toast("success", opts.success);
      opts.onSuccess?.(res.data);
      if (opts.refresh !== false) router.refresh();
      return res.data;
    },
    [router, toast],
  );

  return { run, pending, errors, error, setErrors };
}
