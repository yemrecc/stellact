import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDIYQWDJEJW2XXPRZL2V4OFKJDN3UUHKGYN5QRXJL3HHGDNKNTSMMPSC",
  }
} as const

export const Errors = {
  1: {message:"InvalidAmount"},
  2: {message:"InsufficientBalance"}
}

export interface Client {
  /**
   * Construct and simulate a token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  token: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  balance: ({of}: {of: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * `from` imzalar; token `from` → kontrat. İlk yatırımda `Since` yazılır (kalıcılık ölçümü için).
   */
  deposit: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * `to` imzalar; kontrat → `to`. Bakiye sıfırlanırsa `Since` silinir (kalıcılık kırıldı).
   */
  withdraw: ({to, amount}: {to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a deposited_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * İlk yatırımın ledger zaman damgası (unix sn). 0 = pozisyon yok.
   */
  deposited_at: ({of}: {of: string}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {token}: {token: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({token}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAgAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAEAAAAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAAAg==",
        "AAAAAAAAAAAAAAAFdG9rZW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAJvZgAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAG1gZnJvbWAgaW16YWxhcjsgdG9rZW4gYGZyb21gIOKGkiBrb250cmF0LiDEsGxrIHlhdMSxcsSxbWRhIGBTaW5jZWAgeWF6xLFsxLFyIChrYWzEsWPEsWzEsWsgw7Zsw6fDvG3DvCBpw6dpbikuAAAAAAAAB2RlcG9zaXQAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAGFgdG9gIGltemFsYXI7IGtvbnRyYXQg4oaSIGB0b2AuIEJha2l5ZSBzxLFmxLFybGFuxLFyc2EgYFNpbmNlYCBzaWxpbmlyIChrYWzEsWPEsWzEsWsga8SxcsSxbGTEsSkuAAAAAAAACHdpdGhkcmF3AAAAAgAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAETEsGxrIHlhdMSxcsSxbcSxbiBsZWRnZXIgemFtYW4gZGFtZ2FzxLEgKHVuaXggc24pLiAwID0gcG96aXN5b24geW9rLgAAAAxkZXBvc2l0ZWRfYXQAAAABAAAAAAAAAAJvZgAAAAAAEwAAAAEAAAAG",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    token: this.txFromJSON<string>,
        balance: this.txFromJSON<i128>,
        deposit: this.txFromJSON<Result<void>>,
        withdraw: this.txFromJSON<Result<void>>,
        deposited_at: this.txFromJSON<u64>
  }
}