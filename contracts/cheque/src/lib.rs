#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env, String, Vec,
};

const MAX_MEMO: u32 = 80;
const MAX_PER_PARTY: u32 = 64;
const TTL_THRESHOLD: u32 = 17_280;
const TTL_BUMP: u32 = 518_400;

pub const STATUS_ISSUED: u32 = 0;
pub const STATUS_CASHED: u32 = 1;
pub const STATUS_VOIDED: u32 = 2;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AmountNotPositive = 1,
    DrawerIsPayee = 2,
    MemoTooLong = 3,
    ExpiryInPast = 4,
    NotFound = 5,
    NotIssued = 6,
    NotPayee = 7,
    NotDrawer = 8,
    Expired = 9,
    TooMany = 10,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Cheque {
    pub id: u64,
    pub drawer: Address,
    pub payee: Address,
    pub token: Address,
    pub amount: i128,
    pub memo: String,
    pub status: u32,
    pub issued_at: u64,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    NextId,
    Cheque(u64),
    Written(Address),
    Payable(Address),
}

#[contractevent]
pub struct Wrote {
    #[topic]
    pub drawer: Address,
    #[topic]
    pub payee: Address,
    pub id: u64,
    pub amount: i128,
}

#[contractevent]
pub struct Cashed {
    #[topic]
    pub payee: Address,
    #[topic]
    pub drawer: Address,
    pub id: u64,
    pub amount: i128,
}

#[contractevent]
pub struct Voided {
    #[topic]
    pub drawer: Address,
    #[topic]
    pub payee: Address,
    pub id: u64,
    pub amount: i128,
}

#[contract]
pub struct ChequeContract;

#[contractimpl]
impl ChequeContract {
    /// Escrow `amount` of `token` from `drawer`, payable only to `payee`.
    /// `expires_at` is a unix timestamp. Zero means the cheque does not expire.
    pub fn write(
        env: Env,
        drawer: Address,
        payee: Address,
        token: Address,
        amount: i128,
        memo: String,
        expires_at: u64,
    ) -> u64 {
        drawer.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountNotPositive);
        }
        if drawer == payee {
            panic_with_error!(&env, Error::DrawerIsPayee);
        }
        if memo.len() > MAX_MEMO {
            panic_with_error!(&env, Error::MemoTooLong);
        }
        let now = env.ledger().timestamp();
        if expires_at != 0 && expires_at <= now {
            panic_with_error!(&env, Error::ExpiryInPast);
        }

        let id = next_id(&env);
        let cheque = Cheque {
            id,
            drawer: drawer.clone(),
            payee: payee.clone(),
            token: token.clone(),
            amount,
            memo,
            status: STATUS_ISSUED,
            issued_at: now,
            expires_at,
        };

        push_id(&env, DataKey::Written(drawer.clone()), id);
        push_id(&env, DataKey::Payable(payee.clone()), id);
        env.storage()
            .persistent()
            .set(&DataKey::Cheque(id), &cheque);
        extend_persistent(&env, &DataKey::Cheque(id));
        extend_instance(&env);

        token::Client::new(&env, &token).transfer(
            &drawer,
            &env.current_contract_address(),
            &amount,
        );

        Wrote {
            drawer,
            payee,
            id,
            amount,
        }
        .publish(&env);
        id
    }

    /// Payee claims the escrow. Only the address named on the cheque can cash it.
    pub fn cash(env: Env, payee: Address, id: u64) {
        payee.require_auth();
        let mut cheque = read(&env, id);
        if cheque.payee != payee {
            panic_with_error!(&env, Error::NotPayee);
        }
        ensure_issued(&env, &cheque);
        let now = env.ledger().timestamp();
        if cheque.expires_at != 0 && now >= cheque.expires_at {
            panic_with_error!(&env, Error::Expired);
        }

        cheque.status = STATUS_CASHED;
        env.storage()
            .persistent()
            .set(&DataKey::Cheque(id), &cheque);
        extend_persistent(&env, &DataKey::Cheque(id));
        extend_instance(&env);

        token::Client::new(&env, &cheque.token).transfer(
            &env.current_contract_address(),
            &payee,
            &cheque.amount,
        );
        Cashed {
            payee,
            drawer: cheque.drawer,
            id,
            amount: cheque.amount,
        }
        .publish(&env);
    }

    /// Drawer cancels an uncashed cheque and takes the escrow back.
    /// This also reclaims a cheque that has already expired.
    pub fn void(env: Env, drawer: Address, id: u64) {
        drawer.require_auth();
        let mut cheque = read(&env, id);
        if cheque.drawer != drawer {
            panic_with_error!(&env, Error::NotDrawer);
        }
        ensure_issued(&env, &cheque);

        cheque.status = STATUS_VOIDED;
        env.storage()
            .persistent()
            .set(&DataKey::Cheque(id), &cheque);
        extend_persistent(&env, &DataKey::Cheque(id));
        extend_instance(&env);

        token::Client::new(&env, &cheque.token).transfer(
            &env.current_contract_address(),
            &drawer,
            &cheque.amount,
        );
        Voided {
            drawer,
            payee: cheque.payee,
            id,
            amount: cheque.amount,
        }
        .publish(&env);
    }

    pub fn get(env: Env, id: u64) -> Cheque {
        extend_instance(&env);
        read(&env, id)
    }

    pub fn written_by(env: Env, drawer: Address) -> Vec<Cheque> {
        extend_instance(&env);
        load_many(&env, ids_of(&env, DataKey::Written(drawer)))
    }

    pub fn payable_to(env: Env, payee: Address) -> Vec<Cheque> {
        extend_instance(&env);
        load_many(&env, ids_of(&env, DataKey::Payable(payee)))
    }
}

fn ensure_issued(env: &Env, cheque: &Cheque) {
    if cheque.status != STATUS_ISSUED {
        panic_with_error!(env, Error::NotIssued);
    }
}

fn read(env: &Env, id: u64) -> Cheque {
    let key = DataKey::Cheque(id);
    let cheque = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotFound));
    extend_persistent(env, &key);
    cheque
}

fn next_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextId)
        .unwrap_or(1001);
    env.storage().instance().set(&DataKey::NextId, &(id + 1));
    id
}

fn ids_of(env: &Env, key: DataKey) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

fn push_id(env: &Env, key: DataKey, id: u64) {
    let mut ids = ids_of(env, key.clone());
    if ids.len() >= MAX_PER_PARTY {
        panic_with_error!(env, Error::TooMany);
    }
    ids.push_back(id);
    env.storage().persistent().set(&key, &ids);
    extend_persistent(env, &key);
}

fn load_many(env: &Env, ids: Vec<u64>) -> Vec<Cheque> {
    let mut out = Vec::new(env);
    for id in ids.iter() {
        out.push_back(read(env, id));
    }
    out
}

fn extend_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);
}

fn extend_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_BUMP);
}

#[cfg(test)]
mod test;
