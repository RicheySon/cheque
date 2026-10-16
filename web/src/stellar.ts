import { Client } from "@stellar/stellar-sdk/contract";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { CONTRACT_ID, NETWORK_PASSPHRASE, NATIVE_TOKEN, RPC_URL } from "./config";

export type Cheque = {
  id: bigint;
  drawer: string;
  payee: string;
  token: string;
  amount: bigint;
  memo: string;
  status: number;
  issuedAt: bigint;
  expiresAt: bigint;
};

type RawCheque = {
  id: bigint;
  drawer: string;
  payee: string;
  token: string;
  amount: bigint;
  memo: string;
  status: number;
  issued_at: bigint;
  expires_at: bigint;
};

type ChequeClient = {
  write(args: {
    drawer: string;
    payee: string;
    token: string;
    amount: bigint;
    memo: string;
    expires_at: bigint;
  }): Promise<{ result: bigint; signAndSend: () => Promise<{ result: bigint }> }>;
  cash(args: {
    payee: string;
    id: bigint;
  }): Promise<{ signAndSend: () => Promise<{ result: null }> }>;
  void_(args: {
    drawer: string;
    id: bigint;
  }): Promise<{ signAndSend: () => Promise<{ result: null }> }>;
  get(args: { id: bigint }): Promise<{ result: RawCheque }>;
  written_by(args: { drawer: string }): Promise<{ result: RawCheque[] }>;
  payable_to(args: { payee: string }): Promise<{ result: RawCheque[] }>;
};

const ERRORS: Record<number, { message: string }> = {
  1: { message: "Enter an amount greater than zero." },
  2: { message: "A cheque cannot be payable to the person who writes it." },
  3: { message: "The memo can be at most 80 characters." },
  4: { message: "The expiry has to be in the future." },
  5: { message: "That cheque number does not exist." },
  6: { message: "This cheque is no longer open." },
  7: { message: "Only the payee named on the cheque can cash it." },
  8: { message: "Only the drawer can void this cheque." },
  9: { message: "This cheque has expired. The drawer can void it to take the escrow back." },
  10: { message: "This address already has 64 cheques on this contract." },
};

function normalize(raw: RawCheque): Cheque {
  return {
    id: BigInt(raw.id),
    drawer: raw.drawer,
    payee: raw.payee,
    token: raw.token,
    amount: BigInt(raw.amount),
    memo: raw.memo,
    status: Number(raw.status),
    issuedAt: BigInt(raw.issued_at),
    expiresAt: BigInt(raw.expires_at),
  };
}

async function clientFor(publicKey?: string): Promise<ChequeClient> {
  const client = await Client.from({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
    errorTypes: ERRORS,
    signTransaction: async (xdr, opts) => {
      const signed = await signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase ?? NETWORK_PASSPHRASE,
        address: opts?.address ?? publicKey,
      });
      if (signed.error) {
        throw new Error(signed.error.message);
      }
      return signed;
    },
  });
  return client as unknown as ChequeClient;
}

export async function connectWallet(): Promise<{ address: string; freighter: boolean }> {
  const connected = await isConnected();
  if (connected.error || !connected.isConnected) {
    return { address: "", freighter: false };
  }
  const access = await requestAccess();
  if (access.error || !access.address) {
    throw new Error(access.error?.message ?? "Freighter did not share an address.");
  }
  return { address: access.address, freighter: true };
}

export async function listWritten(address: string): Promise<Cheque[]> {
  const client = await clientFor(address);
  const tx = await client.written_by({ drawer: address });
  return tx.result.map(normalize);
}

export async function listPayable(address: string): Promise<Cheque[]> {
  const client = await clientFor(address);
  const tx = await client.payable_to({ payee: address });
  return tx.result.map(normalize);
}

export async function getCheque(id: bigint, source: string): Promise<Cheque> {
  const client = await clientFor(source);
  const tx = await client.get({ id });
  return normalize(tx.result);
}

export async function writeCheque(args: {
  drawer: string;
  payee: string;
  amount: bigint;
  memo: string;
  expiresAt: bigint;
}): Promise<bigint> {
  const client = await clientFor(args.drawer);
  const tx = await client.write({
    drawer: args.drawer,
    payee: args.payee,
    token: NATIVE_TOKEN,
    amount: args.amount,
    memo: args.memo,
    expires_at: args.expiresAt,
  });
  const sent = await tx.signAndSend();
  return BigInt(sent.result);
}

export async function cashCheque(payee: string, id: bigint): Promise<void> {
  const client = await clientFor(payee);
  const tx = await client.cash({ payee, id });
  await tx.signAndSend();
}

export async function voidCheque(drawer: string, id: bigint): Promise<void> {
  const client = await clientFor(drawer);
  const tx = await client.void_({ drawer, id });
  await tx.signAndSend();
}
