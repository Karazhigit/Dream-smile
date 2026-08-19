import test from "node:test";
import assert from "node:assert/strict";
import { formatKazakhstanPhone, normalizeKazakhstanPhone } from "../lib/phone.ts";

test("normalizes Kazakhstan +7 phone",()=>{assert.equal(normalizeKazakhstanPhone("+7 700 123 45 67"),"+77001234567")});
test("normalizes Kazakhstan phone beginning with 8",()=>{assert.equal(normalizeKazakhstanPhone("8 (700) 123-45-67"),"+77001234567")});
test("rejects invalid phone",()=>{assert.equal(normalizeKazakhstanPhone("+7 700 123"),null)});
test("formats digits for the admin input",()=>{assert.equal(formatKazakhstanPhone("87001234567"),"+7 700 123 45 67")});
