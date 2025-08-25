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
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div className="artistic-card">
          <h1 
            className="glitch neon-text" 
            data-text={`${this.state.tokenData.name} (${this.state.tokenData.symbol})`}
          >
            {this.state.tokenData.name} ({this.state.tokenData.symbol})
          </h1>
          <div style={{ 
            background: 'rgba(0, 255, 255, 0.1)', 
            border: '2px solid var(--neon-cyan)', 
            borderRadius: '12px', 
            padding: '1.5rem',
            margin: '1rem 0'
          }}>
            <p style={{ fontSize: '1.2rem', fontFamily: 'Orbitron, monospace' }}>
              <span className="neon-green-text">CONNECTED:</span> <code>{this.state.selectedAddress}</code>
            </p>
            <p style={{ fontSize: '1.5rem', fontFamily: 'Orbitron, monospace' }}>
              <span className="neon-pink-text">BALANCE:</span> <span className="neon-text" style={{ fontSize: '2rem', fontWeight: 'bold' }}>{this.state.balance.toString()}</span> <span className="neon-green-text">{this.state.tokenData.symbol}</span>
            </p>
          </div>
          
          {/* Artistic Faucet Button */}
          <div style={{ margin: "2rem 0", textAlign: "center" }}>
            <a
              href="https://sepoliafaucet.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="artistic-btn"
              style={{ 
                textDecoration: "none",
                display: "inline-block",
                margin: "1rem"
              }}
            >
              🚰 GET SEPOLIA ETH
            </a>
            <p style={{ 
              color: "rgba(255, 255, 255, 0.7)", 
              fontFamily: 'Fira Code, monospace',
              fontSize: '0.9rem',
              fontStyle: 'italic'
            }}>
              // Need test ETH for gas fees? Access the Sepolia faucet protocol
            </p>
          </div>
        </div>

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
    try {
      const [selectedAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Check network using chainId (more reliable for mobile)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const sepoliaChainId = '0xaa36a7'; // Sepolia chain ID in hex
      
      console.log("Current chain ID:", chainId);
      console.log("Expected chain ID:", sepoliaChainId);
      
      if (chainId !== sepoliaChainId) {
        // Try to switch to Sepolia automatically
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: sepoliaChainId }],
          });
        } catch (switchError) {
          console.error("Failed to switch network:", switchError);
          alert("Please switch to the Sepolia test network in MetaMask.");
          return;
        }
      }
      
      this._initialize(selectedAddress);
      
      // Listen for account changes
      window.ethereum.on("accountsChanged", ([newAddress]) => {
        this._stopPollingData();
        if (newAddress === undefined) return this._resetState();
        this._initialize(newAddress);
      });
      
      // Listen for network changes
      window.ethereum.on("chainChanged", (chainId) => {
        console.log("Network changed to:", chainId);
        if (chainId !== sepoliaChainId) {
          alert("Please switch back to Sepolia network");
          this._resetState();
        } else {
          // Reload data when back on Sepolia
          if (this.state.selectedAddress) {
            this._getTokenData();
            this._updateBalance();
          }
        }
      });
      
    } catch (error) {
      console.error("Wallet connection error:", error);
    }
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
