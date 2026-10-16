# Cheque

A digital cheque on Stellar. You write an amount to someone’s wallet. The tokens are escrowed in a Soroban contract. Only that payee can cash the cheque. You can void it, including after it expires, and take the escrow back.

## Built during Stellar 14

This repository started during Stellar 14. There was no project before 5 October 2026.

What this window added:

- A Soroban cheque contract: `write`, `cash`, `void`, plus reads for one cheque, everything a drawer wrote, and everything payable to an address.
- Escrow of any Stellar asset. The demo uses testnet XLM.
- Rules that match a cheque: the payee is named, a stranger cannot cash it, a cashed cheque is final, an expired cheque cannot be cashed, and the drawer can reclaim it.
- A web app that shows the cheque while you fill it in, then signs with Freighter.
- A completed testnet run: cheque 1001 for 20 XLM was cashed, and cheque 1002 for 5 XLM was voided.

## Network

| | |
| --- | --- |
| Network | Testnet |
| Contract | `CAOHC6KUCGDJE7TPBCTPFVRCRHQKZ4OYOE3L72BRWKPB66N6JTQFEH7M` |
| Wasm hash | `ba3d1109a26222137f27407a7f53c80775cce6e02de8ca0a34e5f84e3f4b905f` |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CAOHC6KUCGDJE7TPBCTPFVRCRHQKZ4OYOE3L72BRWKPB66N6JTQFEH7M |

Transactions from the first run:

- Deploy: https://stellar.expert/explorer/testnet/tx/d6e2d54c05f5644eac9c3b8c67ada89e876260371761b8f11a0719e5496ff141
- Write 20 XLM: https://stellar.expert/explorer/testnet/tx/6e5b6cd96a50030d5fef4995a098607e115628d8dffe60f8f724c145bbf50cea
- Cash: https://stellar.expert/explorer/testnet/tx/679cebaece4137c415e5b00c9b89451442cc586670175a133706f9e2d38f11b8
- Void: https://stellar.expert/explorer/testnet/tx/94b54b81744f9d54c8976df679b1f88c0598104232ff2bb81016aa2211e7110b

## Run the app

You need Node 22 and [Freighter](https://freighter.app) on Testnet, with a little testnet XLM from Friendbot.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173. Connect Freighter. Write a cheque to a second address, send that person `http://localhost:5173/?cheque=NUMBER`, and cash it from their wallet. The page also loads cheques already written by the demo drawer, so the contract is visible before you connect.

## Run the contract tests

Rust 1.84 or newer, the `wasm32v1-none` target, and [Stellar CLI](https://developers.stellar.org/docs/tools/cli) 28.

```bash
cargo test
stellar contract build
```

`scripts/demo.sh` writes and cashes another cheque with two funded CLI identities named `drawer` and `payee`.

## How a cheque behaves

Amounts are in stroops (7 decimal places for XLM). A memo can be 80 characters. `expires_at` is a unix time, and `0` means the cheque does not expire. Each address can be drawer or payee on at most 64 cheques. Status is `0` issued, `1` cashed, `2` voided.

## 30 day plan

See [docs/30-day-scope.md](docs/30-day-scope.md).

## Demo Day, 3 minutes

1. Twenty seconds: a transfer is final immediately. A cheque lets you set money aside for a named wallet.
2. One minute forty: connect, write 20 XLM, show the escrow on the explorer, switch to the payee, cash it. Then void a second cheque.
3. Thirty seconds: before Stellar 14 this repository did not exist. The contract, the escrow rules, and this screen were built in the window.
4. Thirty seconds: one slide from the 30 day scope. Mainnet, a stablecoin, and ten pilot cashes.
