import type { QueryOptions } from "../types";
import { tailLogs } from "./tail";

type TraceOptions = QueryOptions & {
  format?: string;
  sources?: string[];
  jq?: string;
};

type TailExecutor = (options: TraceOptions) => Promise<void>;

export async function traceRequest(
  requestId: string,
  options: TraceOptions,
  executor: TailExecutor = tailLogs,
): Promise<void> {
  const where = options.where ? { ...options.where } : {};
  where.requestId = requestId;

  await executor({
    ...options,
    where,
  });
}
