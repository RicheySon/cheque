# 30 day scope

Project and one liner: Cheque, a digital cheque on Stellar. You escrow tokens to a wallet address, and only that payee can cash them.

Problem and users: Paying someone who is not in front of you still means a transfer that is final the moment it is sent. A cheque lets the drawer set the amount aside and lets the payee collect it, or lets the drawer void it if it was wrong. The users are people who already hold a Stellar wallet and want a payment that can be handed over as a link.

Where it stands now: The Soroban contract is deployed on testnet and the web app can write, cash, and void. A 20 XLM cheque was written and cashed, and a second cheque was voided, on contract `CAOHC6KUCGDJE7TPBCTPFVRCRHQKZ4OYOE3L72BRWKPB66N6JTQFEH7M`. Repo: this repository. Demo: `cd web && npm install && npm run dev`, then connect Freighter on testnet.

Deliverables:

1. The same contract on mainnet, still escrow-only, with the testnet contract id kept for the demo.
2. Cheque links that open the payee straight into Cash, including on a phone browser with Freighter.
3. A USDC (or other Stellar stablecoin) option so a cheque can be denominated in dollars, not only XLM.
4. A short public docs page: how to write, cash, void, and how to check a cheque on stellar.expert.
5. Ten pilot cashes from people outside the team, recorded as transaction hashes.

Stellar components: Soroban contract, Stellar Asset Contracts (native XLM now, a stablecoin next), Freighter, `@stellar/stellar-sdk`, Stellar RPC.

Success criteria:

- Mainnet contract id published in `deployments/mainnet.json`.
- A payee who is not the drawer cashes a cheque and the explorer shows the transfer out of the contract.
- A void before cash returns the escrow, including after expiry.
- Stablecoin cheque works for at least one issued asset.
- Ten cashes from non-team wallets, listed as transaction links.
- Docs page is live and a new user can finish a testnet cheque from the README alone.

Team and roles: Add the 3 to 5 members, who builds the contract, the web app, and the pilot, and the hours each person can give, before the Demo Day form.

Risks: Freighter on the venue Wi-Fi, and testnet or mainnet latency. Cut the stablecoin before cutting the mainnet deploy. Record a backup video of a successful cash. Bring a funded wallet already unlocked.

Award size: A first scope that fits $1,000 to $5,000. Mainnet deploy, stablecoin cheques, and ten pilot users. We will refine the amount with the chapter lead.

## Milestones

Week 1: Contract and web app already work on testnet. Freeze the cheque rules, add the phone layout, and write the pilot script.

Week 2: Main feature stays the same path, now with a stablecoin and a cheque link that opens Cash. Deploy the contract to mainnet.

Week 3: Ten pilot users cash or void a cheque. Fix the failures they hit. Read the contract against the test list again.

Week 4: Docs, demo video, mainnet contract id, and a short report of the ten transactions against the success criteria.
