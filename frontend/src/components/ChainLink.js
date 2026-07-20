import React from "react";

// Links out to Sepolia Etherscan for addresses and transaction hashes.
//
// The app shows database balances everywhere; the chain is verified externally.
// These links are the bridge - the only place the UI points at chain state.
//
// A transaction with no hash, or one of the legacy fabricated hashes, renders as
// a plain label rather than a link. Linking to an Etherscan page that resolves
// to nothing would be worse than saying plainly that there is no on-chain record.

const ETHERSCAN = "https://sepolia.etherscan.io";

const linkStyle = {
  color: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: "2px"
};

const labelStyle = {
  opacity: 0.65,
  fontStyle: "italic"
};

export const shortenHex = (value, lead = 6, tail = 4) =>
  !value || value.length <= lead + tail + 2
    ? value
    : `${value.slice(0, lead)}...${value.slice(-tail)}`;

// A wallet address linked to its Etherscan page. `system` and missing addresses
// are not real accounts, so they render as plain text.
export function AddressLink({ address, label, short = true, style = {} }) {
  if (!address || address === "system") {
    return <span style={style}>{label || address || "-"}</span>;
  }

  return (
    <a
      href={`${ETHERSCAN}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      style={{ ...linkStyle, ...style }}
    >
      {label || (short ? shortenHex(address) : address)}
    </a>
  );
}

// A transaction hash linked to its Etherscan page.
//   hash missing   -> "off-chain"  (a database-only row: deploy credit, joining
//                     credit, admin correction - no on-chain counterpart)
//   fabricated     -> "legacy - no on-chain record"  (written before the ledger
//                     authority refactor, resolves to nothing)
export function TxLink({ hash, fabricated, short = true, style = {} }) {
  if (fabricated) {
    return (
      <span style={{ ...labelStyle, ...style }} title={hash || undefined}>
        legacy — no on-chain record
      </span>
    );
  }

  if (!hash) {
    return <span style={{ ...labelStyle, ...style }}>off-chain</span>;
  }

  return (
    <a
      href={`${ETHERSCAN}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      title={hash}
      style={{ ...linkStyle, ...style }}
    >
      {short ? shortenHex(hash, 10, 8) : hash}
    </a>
  );
}
