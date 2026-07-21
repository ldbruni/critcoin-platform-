// Unit tests for syncAdminTransfers - the safety-critical admin-grant absorber.
//
// No database or RPC: the chain reader and the Transaction model are injected as
// in-memory fakes, so this runs anywhere with `node --test` (Node 18+), no test
// framework to install. It pins the two guarantees that matter most:
//   1. ONLY transfers whose on-chain `from` is the deployer are absorbed.
//   2. Absorption is idempotent on txHash - running twice records once.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { syncAdminTransfers } = require("../lib/adminGrants");

const DEPLOYER = "0xc69c361d300aeaad0aee95bd1c753e62298f92e9";
const STUDENT = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

const hash = (n) => "0x" + String(n).padStart(64, "0");

// A Transaction-model stand-in that enforces the same partial-unique-on-txHash
// behaviour the real Mongo index has (a duplicate string hash throws E11000).
function makeFakeTransaction() {
  const store = [];
  return {
    store,
    async findOne(query) {
      if (query && query.txHash !== undefined) {
        return store.find((d) => d.txHash === query.txHash) || null;
      }
      return null;
    },
    async create(doc) {
      if (typeof doc.txHash === "string" && store.some((d) => d.txHash === doc.txHash)) {
        const err = new Error("duplicate key");
        err.code = 11000;
        throw err;
      }
      const saved = { ...doc, _id: "id" + store.length };
      store.push(saved);
      return saved;
    }
  };
}

// A chain stand-in returning a fixed transfer list, ignoring its args - the point
// is to test syncAdminTransfers' own defense-in-depth `from` filter.
const fakeChain = (transfers) => ({
  async getIncomingTransfersFrom() {
    return transfers;
  }
});

test("absorbs a deployer-sourced transfer once, then is idempotent", async () => {
  const Transaction = makeFakeTransaction();
  const chain = fakeChain([
    { txHash: hash(1), from: DEPLOYER, to: STUDENT, amount: 1, timestamp: new Date() }
  ]);

  const first = await syncAdminTransfers(STUDENT, { deployer: DEPLOYER, chain, Transaction });
  assert.equal(first.recorded.length, 1, "records the grant the first time");
  assert.equal(Transaction.store.length, 1);

  const row = Transaction.store[0];
  assert.equal(row.type, "adminGrant");
  assert.equal(row.fromWallet, "system", "ledger source is 'system' so the deployer isn't debited");
  assert.equal(row.toWallet, STUDENT);
  assert.equal(row.amount, 1);
  assert.equal(row.txHash, hash(1), "stores the real hash");

  // Running again must record nothing (txHash idempotency).
  const second = await syncAdminTransfers(STUDENT, { deployer: DEPLOYER, chain, Transaction });
  assert.equal(second.recorded.length, 0);
  assert.equal(second.skipped, 1);
  assert.equal(Transaction.store.length, 1, "no duplicate row on re-run");
});

test("never absorbs a transfer whose source is not the deployer", async () => {
  const Transaction = makeFakeTransaction();
  // A student->student transfer that somehow reached the reader is dropped.
  const chain = fakeChain([
    { txHash: hash(2), from: OTHER, to: STUDENT, amount: 5, timestamp: new Date() }
  ]);

  const result = await syncAdminTransfers(STUDENT, { deployer: DEPLOYER, chain, Transaction });
  assert.equal(result.recorded.length, 0);
  assert.equal(Transaction.store.length, 0, "non-deployer transfer stays as drift, not absorbed");
});

test("absorbs only the deployer-sourced rows in a mixed batch", async () => {
  const Transaction = makeFakeTransaction();
  const chain = fakeChain([
    { txHash: hash(3), from: DEPLOYER, to: STUDENT, amount: 1, timestamp: new Date() },
    { txHash: hash(4), from: OTHER, to: STUDENT, amount: 9, timestamp: new Date() },
    { txHash: hash(5), from: DEPLOYER, to: STUDENT, amount: 2, timestamp: new Date() }
  ]);

  const result = await syncAdminTransfers(STUDENT, { deployer: DEPLOYER, chain, Transaction });
  assert.equal(result.recorded.length, 2);
  assert.equal(Transaction.store.length, 2);
  assert.deepEqual(
    Transaction.store.map((r) => r.txHash).sort(),
    [hash(3), hash(5)]
  );
});

test("skips non-positive amounts and missing hashes", async () => {
  const Transaction = makeFakeTransaction();
  const chain = fakeChain([
    { txHash: hash(6), from: DEPLOYER, to: STUDENT, amount: 0, timestamp: new Date() },
    { txHash: null, from: DEPLOYER, to: STUDENT, amount: 3, timestamp: new Date() }
  ]);

  const result = await syncAdminTransfers(STUDENT, { deployer: DEPLOYER, chain, Transaction });
  assert.equal(result.recorded.length, 0);
  assert.equal(Transaction.store.length, 0);
});

test("case-insensitive on the deployer address", async () => {
  const Transaction = makeFakeTransaction();
  // Reader hands back a checksummed source; the deployer is passed mixed-case.
  const chain = fakeChain([
    { txHash: hash(7), from: DEPLOYER.toLowerCase(), to: STUDENT, amount: 1, timestamp: new Date() }
  ]);

  const result = await syncAdminTransfers(STUDENT, {
    deployer: DEPLOYER.toUpperCase().replace("0X", "0x"),
    chain,
    Transaction
  });
  assert.equal(result.recorded.length, 1, "matches regardless of address casing");
});
