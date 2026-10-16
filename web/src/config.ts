import deployment from "../../deployments/testnet.json";

export const NETWORK = deployment.network;
export const NETWORK_PASSPHRASE = deployment.networkPassphrase;
export const RPC_URL = deployment.rpcUrl;
export const CONTRACT_ID = deployment.contractId;
export const WASM_HASH = deployment.wasmHash;
export const NATIVE_TOKEN = deployment.nativeToken;
export const DEMO_DRAWER = deployment.demoDrawer;
export const EXPLORER = deployment.explorer;

export const STROOPS = 10_000_000n;
export const STATUS_ISSUED = 0;
export const STATUS_CASHED = 1;
export const STATUS_VOIDED = 2;
