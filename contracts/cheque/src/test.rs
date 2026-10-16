extern crate std;

use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{token, Address, Env, Error as SdkError, InvokeError, String};

fn expect_err<T>(result: Result<T, Result<SdkError, InvokeError>>, error: Error) {
    assert_eq!(result.err(), Some(Ok(error.into())));
}

use super::{
    ChequeContract, ChequeContractClient, Error, STATUS_CASHED, STATUS_ISSUED, STATUS_VOIDED,
};

fn asset(env: &Env) -> (Address, token::Client<'_>, token::StellarAssetClient<'_>) {
    let issuer = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let address = sac.address();
    (
        address.clone(),
        token::Client::new(env, &address),
        token::StellarAssetClient::new(env, &address),
    )
}

fn contract(env: &Env) -> ChequeContractClient<'_> {
    let address = env.register(ChequeContract, ());
    ChequeContractClient::new(env, &address)
}

fn memo(env: &Env, text: &str) -> String {
    String::from_str(env, text)
}

#[test]
fn write_and_cash_moves_escrow_to_payee() {
    let env = Env::default();
    env.mock_all_auths();
    let (token_address, token, admin) = asset(&env);
    let client = contract(&env);
    let drawer = Address::generate(&env);
    let payee = Address::generate(&env);
    admin.mint(&drawer, &1_000);

    let id = client.write(
        &drawer,
        &payee,
        &token_address,
        &400,
        &memo(&env, "For the market run"),
        &0,
    );

    assert_eq!(token.balance(&drawer), 600);
    assert_eq!(token.balance(&client.address), 400);
    assert_eq!(token.balance(&payee), 0);

    let stored = client.get(&id);
    assert_eq!(stored.status, STATUS_ISSUED);
    assert_eq!(stored.amount, 400);
    assert_eq!(stored.memo, memo(&env, "For the market run"));

    client.cash(&payee, &id);
    assert_eq!(token.balance(&client.address), 0);
    assert_eq!(token.balance(&payee), 400);
    assert_eq!(client.get(&id).status, STATUS_CASHED);
    assert_eq!(client.payable_to(&payee).len(), 1);
    assert_eq!(client.written_by(&drawer).len(), 1);
}

#[test]
fn void_returns_escrow_to_drawer() {
    let env = Env::default();
    env.mock_all_auths();
    let (token_address, token, admin) = asset(&env);
    let client = contract(&env);
    let drawer = Address::generate(&env);
    let payee = Address::generate(&env);
    admin.mint(&drawer, &1_000);

    let id = client.write(
        &drawer,
        &payee,
        &token_address,
        &250,
        &memo(&env, "Hold"),
        &0,
    );
    client.void(&drawer, &id);

    assert_eq!(token.balance(&drawer), 1_000);
    assert_eq!(token.balance(&client.address), 0);
    assert_eq!(token.balance(&payee), 0);
    assert_eq!(client.get(&id).status, STATUS_VOIDED);
}

#[test]
fn expired_cheque_cannot_be_cashed_and_can_be_reclaimed() {
    let env = Env::default();
    env.mock_all_auths();
    let (token_address, token, admin) = asset(&env);
    let client = contract(&env);
    let drawer = Address::generate(&env);
    let payee = Address::generate(&env);
    admin.mint(&drawer, &1_000);

    env.ledger().with_mut(|ledger| {
        ledger.timestamp = 1_000;
    });
    let id = client.write(
        &drawer,
        &payee,
        &token_address,
        &80,
        &memo(&env, "Due Friday"),
        &1_500,
    );

    env.ledger().with_mut(|ledger| {
        ledger.timestamp = 1_500;
    });
    expect_err(client.try_cash(&payee, &id), Error::Expired);
    assert_eq!(token.balance(&payee), 0);
    assert_eq!(token.balance(&client.address), 80);

    client.void(&drawer, &id);
    assert_eq!(token.balance(&drawer), 1_000);
    assert_eq!(client.get(&id).status, STATUS_VOIDED);
}

#[test]
fn only_the_named_payee_can_cash() {
    let env = Env::default();
    env.mock_all_auths();
    let (token_address, token, admin) = asset(&env);
    let client = contract(&env);
    let drawer = Address::generate(&env);
    let payee = Address::generate(&env);
    let stranger = Address::generate(&env);
    admin.mint(&drawer, &500);

    let id = client.write(
        &drawer,
        &payee,
        &token_address,
        &100,
        &memo(&env, "Rent"),
        &0,
    );
    expect_err(client.try_cash(&stranger, &id), Error::NotPayee);
    assert_eq!(token.balance(&stranger), 0);
    assert_eq!(token.balance(&client.address), 100);

    expect_err(client.try_cash(&drawer, &id), Error::NotPayee);
}

#[test]
fn payee_cannot_void_and_cashed_cheque_is_final() {
    let env = Env::default();
    env.mock_all_auths();
    let (token_address, token, admin) = asset(&env);
    let client = contract(&env);
    let drawer = Address::generate(&env);
    let payee = Address::generate(&env);
    admin.mint(&drawer, &500);

    let id = client.write(
        &drawer,
        &payee,
        &token_address,
        &100,
        &memo(&env, "Lunch"),
        &0,
    );
    expect_err(client.try_void(&payee, &id), Error::NotDrawer);

    client.cash(&payee, &id);
    expect_err(client.try_cash(&payee, &id), Error::NotIssued);
    expect_err(client.try_void(&drawer, &id), Error::NotIssued);
    assert_eq!(token.balance(&payee), 100);
}

#[test]
fn rejects_empty_self_and_stale_cheques() {
    let env = Env::default();
    env.mock_all_auths();
    let (token_address, _, admin) = asset(&env);
    let client = contract(&env);
    let drawer = Address::generate(&env);
    let payee = Address::generate(&env);
    admin.mint(&drawer, &500);

    expect_err(
        client.try_write(&drawer, &payee, &token_address, &0, &memo(&env, "zero"), &0),
        Error::AmountNotPositive,
    );
    expect_err(
        client.try_write(
            &drawer,
            &drawer,
            &token_address,
            &10,
            &memo(&env, "self"),
            &0,
        ),
        Error::DrawerIsPayee,
    );

    let long = memo(
        &env,
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
    assert_eq!(long.len(), 81);
    expect_err(
        client.try_write(&drawer, &payee, &token_address, &10, &long, &0),
        Error::MemoTooLong,
    );

    env.ledger().with_mut(|ledger| {
        ledger.timestamp = 50;
    });
    expect_err(
        client.try_write(
            &drawer,
            &payee,
            &token_address,
            &10,
            &memo(&env, "late"),
            &50,
        ),
        Error::ExpiryInPast,
    );
    expect_err(client.try_get(&999), Error::NotFound);
}
