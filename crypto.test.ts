import { test } from "node:test"; import assert from "node:assert/strict";
import { verifySignature, safeEq } from "../worker/index.ts";
const sig = async (s: string, b: string) => { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return btoa([...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(b)))].reduce((a, x) => a + String.fromCharCode(x), "")); };
test("valid signature accepted", async () => assert.equal(await verifySignature("s3", '{"a":1}', await sig("s3", '{"a":1}')), true));
test("tampered body rejected", async () => assert.equal(await verifySignature("s3", '{"a":2}', await sig("s3", '{"a":1}')), false));
test("wrong secret rejected", async () => assert.equal(await verifySignature("x", '{"a":1}', await sig("s3", '{"a":1}')), false));
test("safeEq length", () => assert.equal(safeEq("a", "ab"), false));

test("hex signature is rejected (docs specify Base64 only)", async () => assert.equal(await verifySignature("s3", "{}", "00".repeat(32)), false));
