#!/usr/bin/env bash
# Repeat the testnet cheque flow with two local Stellar CLI identities.
# Create them once with:
#   stellar keys generate drawer --fund --network testnet
#   stellar keys generate payee --fund --network testnet
set -euo pipefail

CONTRACT=CAOHC6KUCGDJE7TPBCTPFVRCRHQKZ4OYOE3L72BRWKPB66N6JTQFEH7M
XLM=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
DRAWER=$(stellar keys public-key drawer)
PAYEE=$(stellar keys public-key payee)

echo "Writing 20 XLM from $DRAWER to $PAYEE"
ID=$(stellar contract invoke --id "$CONTRACT" --source drawer --network testnet -- write \
  --drawer "$DRAWER" --payee "$PAYEE" --token "$XLM" --amount 200000000 \
  --memo "Demo day" --expires_at 0)
echo "Cheque $ID"
echo "Cashing as payee"
stellar contract invoke --id "$CONTRACT" --source payee --network testnet -- cash \
  --payee "$PAYEE" --id "$ID"
echo "Cheque $ID is cashed"
stellar contract invoke --id "$CONTRACT" --source drawer --network testnet --send=no -- get --id "$ID"
