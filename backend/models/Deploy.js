const mongoose = require("mongoose");

// One row per student in a deploy round. Rows are embedded rather than a
// separate collection: a class roster is on the order of 30 students, well
// inside the document size limit, and the whole round is always read together.
//
// Status lifecycle:
//   pending         - row created, nothing written yet
//   credited        - database ledger credited; on-chain transfer not yet done
//   chain_confirmed - transfer mined, real hash stored
//   chain_failed    - transfer failed; error stored, retried on the next run
//
// A row never moves backwards. chain_failed rows are retried in place.
const deployRowSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  name: { type: String },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'credited', 'chain_confirmed', 'chain_failed']
  },
  // Real Sepolia hash once confirmed. Never fabricated.
  txHash: { type: String, default: null },
  error: { type: String, default: null },
  // The Transaction document that credited this student, so a re-run can prove
  // the credit already happened instead of writing a second one.
  creditTxId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  creditedAt: { type: Date, default: null },
  confirmedAt: { type: Date, default: null }
}, { _id: false });

const deploySchema = new mongoose.Schema({
  createdBy: { type: String, required: true },
  amountPerStudent: { type: Number, required: true },
  status: {
    type: String,
    required: true,
    default: 'in_progress',
    enum: ['in_progress', 'complete']
  },
  rows: [deployRowSchema],
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

deploySchema.index({ createdAt: -1 });

// A round is finished when no row is still awaiting its on-chain transfer.
// chain_failed counts as resolved - the admin decides whether to retry.
deploySchema.methods.refreshStatus = function () {
  const unresolved = this.rows.some(
    (r) => r.status === 'pending' || r.status === 'credited'
  );
  this.status = unresolved ? 'in_progress' : 'complete';
  this.completedAt = unresolved ? null : new Date();
  return this.status;
};

module.exports = mongoose.model("Deploy", deploySchema);
