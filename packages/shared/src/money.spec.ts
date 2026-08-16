import assert from "node:assert/strict";
import test from "node:test";
import { Money } from "./money";
import { ErrorCodes } from "./errors";
import { routingKey } from "./events";

test("money adds in the same currency", () => {
  const total = Money.of("BDT", "10.5000").add(Money.of("BDT", "0.2500"));
  assert.equal(total.toString(), "10.7500");
});

test("money rejects mixed currencies", () => {
  assert.throws(() => Money.of("BDT", "1").add(Money.of("USD", "1")));
});

test("error codes are stable machine values", () => {
  assert.equal(ErrorCodes.INSUFFICIENT_STOCK, "INV.INSUFFICIENT_STOCK");
  assert.equal(ErrorCodes.PERIOD_CLOSED, "FIN.PERIOD_CLOSED");
});

test("routing keys include a version suffix", () => {
  assert.equal(routingKey("platform.sample.created", 1), "platform.sample.created.v1");
});
