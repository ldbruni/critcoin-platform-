import React from "react";
import { ethers } from "ethers";
import TokenArtifact from "../contracts/Token.json";
import contractAddress from "../contracts/contract-address.json";
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Transfer } from "./Transfer";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { NoTokensMessage } from "./NoTokensMessage";

const SEPOLIA_CHAIN_ID = '11155111';
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

export class Dapp extends React.Component {
  constructor(props) {
    super(props);
    this.initialState = {
      tokenData: undefined,
      selectedAddress: undefined,
      balance: undefined,
      txBeingSent: undefined,
      transactionError: undefined,
      networkError: undefined,
    };
    this.state = this.initialState;
  }

  render() {
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet 
          connectWallet={() => this._connectWallet()} 
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
        />
      );
    }

    if (!this.state.tokenData || !this.state.balance) {
      return <Loading />;
    }

    return (
      <div className="container p-4">
        <div className="row">
          <div className="col-12">
            <h1>{this.state.tokenData.name} ({this.state.tokenData.symbol})</h1>
            <p>
              Welcome <b>{this.state.selectedAddress}</b>, you have <b>{this.state.balance.toString()} {this.state.tokenData.symbol}</b>.
            </p>
            
            {/* Sepolia ETH Faucet Button */}
            <div style={{ marginBottom: "1rem" }}>
              <a
                href="https://sepoliafaucet.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#007bff",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "0.375rem",
                  fontWeight: "500",
                  fontSize: "1rem",
                  border: "none",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease-in-out",
                  marginRight: "1rem"
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = "#0056b3"}
                onMouseOut={(e) => e.target.style.backgroundColor = "#007bff"}
              >
                🚰 Get Sepolia ETH
              </a>
              <small style={{ color: "#6c757d" }}>
                Need test ETH for gas fees? Use the Sepolia faucet!
              </small>
            </div>
          </div>
        </div>
        <hr />

        <div className="row">
          <div className="col-12">
            {this.state.txBeingSent && (
              <WaitingForTransactionMessage txHash={this.state.txBeingSent} />
            )}
            {this.state.transactionError && (
              <TransactionErrorMessage
                message={this._getRpcErrorMessage(this.state.transactionError)}
                dismiss={() => this._dismissTransactionError()}
              />
            )}
          </div>
        </div>

        <div className="row">
          <div className="col-12">
            {this.state.balance.eq(0) && (
              <NoTokensMessage selectedAddress={this.state.selectedAddress} />
            )}
            {this.state.balance.gt(0) && (
              <Transfer
                transferTokens={(to, amount) => this._transferTokens(to, amount)}
                tokenSymbol={this.state.tokenData?.symbol || "CRT"}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  componentWillUnmount() {
    this._stopPollingData();
  }

  async _connectWallet() {
    const [selectedAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (window.ethereum.networkVersion !== SEPOLIA_CHAIN_ID) {
      alert("Please switch to the Sepolia test network in MetaMask.");
      return;
    }
    this._initialize(selectedAddress);
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      this._stopPollingData();
      if (newAddress === undefined) return this._resetState();
      this._initialize(newAddress);
    });
  }

  _initialize(userAddress) {
    this.setState({ selectedAddress: userAddress });
    this._initializeEthers();
    this._getTokenData();
    this._startPollingData();
  }

  async _initializeEthers() {
    this._provider = new ethers.providers.Web3Provider(window.ethereum);
    this._token = new ethers.Contract(
      contractAddress.Token,
      TokenArtifact.abi,
      this._provider.getSigner(0)
    );
  }

  _startPollingData() {
    this._pollDataInterval = setInterval(() => this._updateBalance(), 1000);
    this._updateBalance();
  }

  _stopPollingData() {
    clearInterval(this._pollDataInterval);
    this._pollDataInterval = undefined;
  }

  async _getTokenData() {
    const name = await this._token.name();
    const symbol = await this._token.symbol();
    this.setState({ tokenData: { name, symbol } });
  }

  async _updateBalance() {
    if (!this.state.selectedAddress || !ethers.utils.isAddress(this.state.selectedAddress)) return;
    const balance = await this._token.balanceOf(this.state.selectedAddress);
    this.setState({ balance });
  }

  async _transferTokens(to, amount) {
    console.log("Transfer initiated with:", to, amount);
    try {
      if (!to || !ethers.utils.isAddress(to)) throw new Error(`Invalid recipient address: ${to}`);
      if (!amount || isNaN(amount) || Number(amount) <= 0) throw new Error(`Invalid amount: ${amount}`);

      this._dismissTransactionError();

      const tx = await this._token.transfer(to, amount);
      this.setState({ txBeingSent: tx.hash });

      const receipt = await tx.wait();
      if (receipt.status === 0) throw new Error("Transaction failed");

      await this._updateBalance();
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) return;
      console.error("Transfer failed:", error);
      this.setState({ transactionError: error });
    } finally {
      this.setState({ txBeingSent: undefined });
    }
  }

  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }

  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  _getRpcErrorMessage(error) {
    return error?.data?.message || error.message;
  }

  _resetState() {
    this.setState(this.initialState);
  }
}
