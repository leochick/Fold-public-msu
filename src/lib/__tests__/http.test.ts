import { describe, test, expect } from "vitest";
import { httpErr, HttpError } from "../http";

describe("HttpError factory", () => {
  test("badRequest is 400", () => {
    const e = httpErr.badRequest("nope");
    expect(e).toBeInstanceOf(HttpError);
    expect(e.status).toBe(400);
    expect(e.message).toBe("nope");
  });

  test("unauthorized is 401", () => {
    expect(httpErr.unauthorized().status).toBe(401);
  });

  test("forbidden is 403", () => {
    expect(httpErr.forbidden().status).toBe(403);
  });

  test("notFound is 404", () => {
    expect(httpErr.notFound().status).toBe(404);
  });

  test("conflict is 409", () => {
    expect(httpErr.conflict().status).toBe(409);
  });

  test("upstream is 502", () => {
    expect(httpErr.upstream().status).toBe(502);
  });
});
