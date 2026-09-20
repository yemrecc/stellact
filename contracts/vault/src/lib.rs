//! Vault — "yatır ve tut" görevlerinin doğrulama hedefi.
//! deposit/withdraw/balance/deposited_at. Token: Circle testnet USDC SAC.
#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env};

#[contracttype]
pub enum DataKey {
    Token,
    Bal(Address),
    Since(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InsufficientBalance = 2,
}

const DAY_LEDGERS: u32 = 17_280; // ~5 sn/ledger
const TTL_THRESHOLD: u32 = DAY_LEDGERS * 30;
const TTL_EXTEND: u32 = DAY_LEDGERS * 120;

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&DataKey::Token, &token);
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    /// `from` imzalar; token `from` → kontrat. İlk yatırımda `Since` yazılır (kalıcılık ölçümü için).
    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(&from, &env.current_contract_address(), &amount);

        let bal_key = DataKey::Bal(from.clone());
        let since_key = DataKey::Since(from.clone());
        let bal: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        if bal == 0 {
            env.storage().persistent().set(&since_key, &env.ledger().timestamp());
            env.storage().persistent().extend_ttl(&since_key, TTL_THRESHOLD, TTL_EXTEND);
        }
        env.storage().persistent().set(&bal_key, &(bal + amount));
        env.storage().persistent().extend_ttl(&bal_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("deposit"), from), amount);
        Ok(())
    }

    /// `to` imzalar; kontrat → `to`. Bakiye sıfırlanırsa `Since` silinir (kalıcılık kırıldı).
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        to.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let bal_key = DataKey::Bal(to.clone());
        let bal: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        if bal < amount {
            return Err(Error::InsufficientBalance);
        }
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_addr).transfer(&env.current_contract_address(), &to, &amount);

        let remaining = bal - amount;
        if remaining == 0 {
            env.storage().persistent().remove(&bal_key);
            env.storage().persistent().remove(&DataKey::Since(to.clone()));
        } else {
            env.storage().persistent().set(&bal_key, &remaining);
            env.storage().persistent().extend_ttl(&bal_key, TTL_THRESHOLD, TTL_EXTEND);
        }
        env.events().publish((symbol_short!("withdraw"), to), amount);
        Ok(())
    }

    pub fn balance(env: Env, of: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Bal(of)).unwrap_or(0)
    }

    /// İlk yatırımın ledger zaman damgası (unix sn). 0 = pozisyon yok.
    pub fn deposited_at(env: Env, of: Address) -> u64 {
        env.storage().persistent().get(&DataKey::Since(of)).unwrap_or(0)
    }
}

mod test;
