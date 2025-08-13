const fs = require("fs");
const path = require("path");

async function main() {
  // Warn if using Hardhat network
  if (network.name === "hardhat") {
    console.warn(
      "You are deploying to the Hardhat Network, which resets on every run. Use '--network localhost' for persistent testing."
    );
  }

  // Get deployer wallet
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Token contract with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy contract
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.deployed();

  console.log("✅ Token deployed to:", token.address);

  // Save contract files for frontend
  saveFrontendFiles(token);
}

function saveFrontendFiles(token) {
  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // Save contract-address.json
  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({ Token: token.address }, null, 2)
  );

  // Save full ABI as Token.json
  const TokenArtifact = artifacts.readArtifactSync("Token");
  fs.writeFileSync(
    path.join(contractsDir, "Token.json"),
    JSON.stringify(TokenArtifact, null, 2)
  );

  // Save a combined sepolia.json (ABI + address)
  fs.writeFileSync(
    path.join(contractsDir, "sepolia.json"),
    JSON.stringify(
      {
        address: token.address,
        abi: TokenArtifact.abi
      },
      null,
      2
    )
  );

  console.log("✅ Wrote Token.json, contract-address.json, and sepolia.json to frontend.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
