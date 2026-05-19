import { NextResponse } from "next/server";
import type { ZodTypeAny, z } from "zod";
import { getCurrentUser, isDemoMode } from "./auth";
import { logger, newRequestId } from "./logger";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const httpErr = {
  badRequest: (msg = "bad request") => new HttpError(400, msg),
  unauthorized: (msg = "unauthorized") => new HttpError(401, msg),
  forbidden: (msg = "forbidden") => new HttpError(403, msg),
  notFound: (msg = "not found") => new HttpError(404, msg),
  conflict: (msg = "conflict") => new HttpError(409, msg),
  rateLimit: (msg = "rate limited") => new HttpError(429, msg),
  upstream: (msg = "upstream failure") => new HttpError(502, msg),
};

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export type RouteCtx<P, B> = {
  user: User;
  req: Request;
  params: P;
  body: B;
  reqId: string;
};

export type Handler<P, B, R> = (ctx: RouteCtx<P, B>) => Promise<R>;

type Options<S extends ZodTypeAny | undefined> = {
  bodySchema?: S;
  demoMock?: () => unknown | Promise<unknown>;
  parseJson?: boolean;
};

export function withAuth<
  P = Record<string, string>,
  S extends ZodTypeAny | undefined = undefined,
  R = unknown
>(
  handler: Handler<P, S extends ZodTypeAny ? z.infer<S> : unknown, R>,
  options: Options<S> = {}
) {
  return async (req: Request, context: { params: Promise<P> }) => {
    const reqId = newRequestId();
    try {
      if (isDemoMode() && options.demoMock) {
        const data = await options.demoMock();
        return jsonOrResponse(data);
      }

      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      const params = context && context.params ? await context.params : ({} as P);

      let body: unknown = undefined;
      const wantsBody = options.parseJson !== false && options.bodySchema !== undefined;
      if (wantsBody) {
        let parsed: unknown;
        try {
          parsed = await req.json();
        } catch {
          throw httpErr.badRequest("bad json");
        }
        const result = options.bodySchema!.safeParse(parsed);
        if (!result.success) {
          throw httpErr.badRequest(
            `validation: ${result.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
              .join("; ")}`
          );
        }
        body = result.data;
      }

      const out = await handler({
        user,
        req,
        params,
        body: body as S extends ZodTypeAny ? z.infer<S> : unknown,
        reqId,
      });
      return jsonOrResponse(out);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      logger.reportError(err, { reqId, url: req.url });
      const msg = err instanceof Error ? err.message : "internal error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}

function jsonOrResponse(value: unknown) {
  if (value instanceof NextResponse) return value;
  if (value instanceof Response) return value;
  return NextResponse.json(value);
}
