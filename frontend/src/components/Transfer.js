import React from "react";
import { utils as ethersUtils } from "ethers";

export function Transfer({ transferTokens, tokenSymbol }) {
  return (
    <div>
      <h4>Transfer</h4>
      <form
        onSubmit={(event) => {
          event.preventDefault();

          const formData = new FormData(event.target);
          const to = formData.get("to").trim();
          const amount = formData.get("amount").trim();

          // ✅ Address validation
          if (!to || !ethersUtils.isAddress(to)) {
            alert("❌ Please enter a valid Ethereum address.");
            return;
          }

          // ✅ Amount validation
          if (!amount || isNaN(amount) || Number(amount) <= 0) {
            alert("❌ Please enter a valid amount greater than 0.");
            return;
          }

          transferTokens(to, amount);
        }}
      >
        <div className="form-group">
          <label>Amount of {tokenSymbol}</label>
          <input
            className="form-control"
            type="number"
            step="1"
            name="amount"
            placeholder="1"
            required
          />
        </div>
        <div className="form-group">
          <label>Recipient address</label>
          <input
            className="form-control"
            type="text"
            name="to"
            placeholder="0x..."
            required
          />
        </div>
        <div className="form-group">
          <input className="btn btn-primary" type="submit" value="Transfer" />
        </div>
      </form>
    </div>
  );
}
