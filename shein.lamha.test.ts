import { test } from "node:test"; import assert from "node:assert/strict";
import { normalize, cartView, selectItems } from "../worker/shein.ts";
const info = { normalProducts: [
  { goods_id: "1", goods_name: "Dress", sku_code: "s1", goods_img: "//i/1.jpg", stock: "5", salePrice: { amount: "5.70", amountWithSymbol: "$5.70", usdAmount: "5.70" }, retailPrice: { amount: "7.60", amountWithSymbol: "$7.60", usdAmount: "7.60" }, unit_discount: "25" },
  { goods_id: "3", goods_name: "NoUsd", sku_code: "s3", salePrice: { amount: "63.05", amountWithSymbol: "$MXN63.05" } }],
  outStock: [{ goods_id: "2", goods_name: "Gone", salePrice: { amount: "1.00", amountWithSymbol: "$1.00", usdAmount: "1.00" } }] };
const view = () => cartView(normalize(info, { groupId: "9", localCountry: "OTHER" }, "m.shein.com", { requested: "USD", shown: "MXN" })).items;
test("USD cents come from usdAmount; no usd => not orderable", () => {
  const v = view(); assert.equal(v[0].unitUsdCents, 570); assert.equal(v[0].originalUsdCents, 760); assert.equal(v[0].savingsUsdCents, 190);
  assert.equal(v[0].discountKind, "unconfirmed"); assert.equal(v[1].orderable, false); assert.equal(v[1].orderableReason, "no_usd_price");
});
test("sold out items cannot be ordered", () => { assert.throws(() => selectItems(view(), { "2:": 1 }), /item_sold_out/); });
test("quantity is required and validated (no quantities in share payload)", () => {
  assert.throws(() => selectItems(view(), {}), /no_items_selected/); assert.throws(() => selectItems(view(), { "1:s1": 1.5 }), /bad_quantity/);
  assert.throws(() => selectItems(view(), { "1:s1": 101 }), /bad_quantity/); assert.throws(() => selectItems(view(), { "9:x": 1 }), /item_not_in_cart/);
});
test("selected items carry server-side cost in exact dollars", () => assert.deepEqual(selectItems(view(), { "1:s1": 2 }), [{ ref: "shein:1", name: "Dress", qty: 2, cost: 5.7 }]));
