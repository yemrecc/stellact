#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

fn setup() -> (Env, VaultClient<'static>, token::StellarAssetClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_700_000_000);

    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_admin = token::StellarAssetClient::new(&env, &sac.address());

    let vault_id = env.register(Vault, (sac.address(),));
    let vault = VaultClient::new(&env, &vault_id);

    let user = Address::generate(&env);
    token_admin.mint(&user, &1_000_0000000); // 1000 USDC (7 ondalık)
    (env, vault, token_admin, user)
}

#[test]
fn deposit_sets_since_and_balance() {
    let (env, vault, _t, user) = setup();
    vault.deposit(&user, &500_0000000);
    assert_eq!(vault.balance(&user), 500_0000000);
    assert_eq!(vault.deposited_at(&user), 1_700_000_000);

    // ikinci yatırım Since'i değiştirmez
    env.ledger().set_timestamp(1_700_100_000);
    vault.deposit(&user, &100_0000000);
    assert_eq!(vault.balance(&user), 600_0000000);
    assert_eq!(vault.deposited_at(&user), 1_700_000_000);
}

#[test]
fn partial_withdraw_keeps_since_full_withdraw_clears_it() {
    let (_env, vault, _t, user) = setup();
    vault.deposit(&user, &500_0000000);
    vault.withdraw(&user, &200_0000000);
    assert_eq!(vault.balance(&user), 300_0000000);
    assert_eq!(vault.deposited_at(&user), 1_700_000_000);

    vault.withdraw(&user, &300_0000000);
    assert_eq!(vault.balance(&user), 0);
    assert_eq!(vault.deposited_at(&user), 0);
}

#[test]
fn rejects_bad_amounts() {
    let (_env, vault, _t, user) = setup();
    assert_eq!(vault.try_deposit(&user, &0).err().unwrap().unwrap(), Error::InvalidAmount);
    vault.deposit(&user, &10_0000000);
    assert_eq!(vault.try_withdraw(&user, &11_0000000).err().unwrap().unwrap(), Error::InsufficientBalance);
}
