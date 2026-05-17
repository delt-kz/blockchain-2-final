import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  DelegateChanged,
  Transfer as TokenTransferEvent,
} from "../generated/GovernanceToken/GovernanceToken";
import {
  ProposalCanceled,
  ProposalCreated,
  ProposalExecuted,
  ProposalQueued,
  VoteCast as VoteCastEvent,
} from "../generated/ProtocolGovernor/ProtocolGovernor";
import {
  LiquidityAdded,
  LiquidityRemoved,
  Swap as SwapEvent,
} from "../generated/DefiSwapPair/DefiSwapPair";
import {
  Deposit as VaultDepositEvent,
  Withdraw as VaultWithdrawEvent,
} from "../generated/YieldVault/YieldVault";
import { TransferSingle } from "../generated/ProtocolItems/ProtocolItems";
import {
  DelegateChange,
  ItemTransfer,
  LiquidityPosition,
  Proposal,
  Swap,
  TokenTransfer,
  VaultDeposit,
  VaultWithdraw,
  VoteCast,
} from "../generated/schema";

const ZERO = BigInt.fromI32(0);

export function handleTokenTransfer(event: TokenTransferEvent): void {
  const entity = new TokenTransfer(eventId(event.transaction.hash, event.logIndex));
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.value = event.params.value;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleDelegateChanged(event: DelegateChanged): void {
  const entity = new DelegateChange(eventId(event.transaction.hash, event.logIndex));
  entity.delegator = event.params.delegator;
  entity.fromDelegate = event.params.fromDelegate;
  entity.toDelegate = event.params.toDelegate;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleProposalCreated(event: ProposalCreated): void {
  const entity = new Proposal(event.params.proposalId.toString());
  entity.proposer = event.params.proposer;
  entity.description = event.params.description;
  entity.voteStart = event.params.voteStart;
  entity.voteEnd = event.params.voteEnd;
  entity.status = "Created";
  entity.createdTransactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleProposalQueued(event: ProposalQueued): void {
  const entity = getOrCreateProposal(event.params.proposalId, event);
  entity.status = "Queued";
  entity.etaSeconds = event.params.etaSeconds;
  entity.save();
}

export function handleProposalCanceled(event: ProposalCanceled): void {
  const entity = getOrCreateProposal(event.params.proposalId, event);
  entity.status = "Canceled";
  entity.save();
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  const entity = getOrCreateProposal(event.params.proposalId, event);
  entity.status = "Executed";
  entity.save();
}

export function handleVoteCast(event: VoteCastEvent): void {
  const entity = new VoteCast(eventId(event.transaction.hash, event.logIndex));
  entity.proposalId = event.params.proposalId;
  entity.voter = event.params.voter;
  entity.support = event.params.support;
  entity.weight = event.params.weight;
  entity.reason = event.params.reason;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleSwap(event: SwapEvent): void {
  const entity = new Swap(eventId(event.transaction.hash, event.logIndex));
  entity.sender = event.params.sender;
  entity.tokenIn = event.params.tokenIn;
  entity.to = event.params.to;
  entity.amountIn = event.params.amountIn;
  entity.amountOut = event.params.amountOut;
  entity.feeAmount = event.params.feeAmount;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleLiquidityAdded(event: LiquidityAdded): void {
  const entity = getOrCreateLiquidityPosition(event.params.provider, event.params.to);
  entity.shares = entity.shares.plus(event.params.shares);
  entity.amount0Added = entity.amount0Added.plus(event.params.amount0);
  entity.amount1Added = entity.amount1Added.plus(event.params.amount1);
  entity.updatedAtBlock = event.block.number;
  entity.updatedAtTimestamp = event.block.timestamp;
  entity.save();
}

export function handleLiquidityRemoved(event: LiquidityRemoved): void {
  const entity = getOrCreateLiquidityPosition(event.params.provider, event.params.to);
  entity.shares = entity.shares.minus(event.params.shares);
  entity.amount0Removed = entity.amount0Removed.plus(event.params.amount0);
  entity.amount1Removed = entity.amount1Removed.plus(event.params.amount1);
  entity.updatedAtBlock = event.block.number;
  entity.updatedAtTimestamp = event.block.timestamp;
  entity.save();
}

export function handleVaultDeposit(event: VaultDepositEvent): void {
  const entity = new VaultDeposit(eventId(event.transaction.hash, event.logIndex));
  entity.caller = event.params.sender;
  entity.owner = event.params.owner;
  entity.assets = event.params.assets;
  entity.shares = event.params.shares;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleVaultWithdraw(event: VaultWithdrawEvent): void {
  const entity = new VaultWithdraw(eventId(event.transaction.hash, event.logIndex));
  entity.caller = event.params.sender;
  entity.receiver = event.params.receiver;
  entity.owner = event.params.owner;
  entity.assets = event.params.assets;
  entity.shares = event.params.shares;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

export function handleItemTransferSingle(event: TransferSingle): void {
  const entity = new ItemTransfer(eventId(event.transaction.hash, event.logIndex));
  entity.operator = event.params.operator;
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.tokenId = event.params.id;
  entity.value = event.params.value;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.save();
}

function eventId(hash: Bytes, logIndex: BigInt): Bytes {
  return hash.concatI32(logIndex.toI32());
}

function getOrCreateLiquidityPosition(provider: Bytes, receiver: Bytes): LiquidityPosition {
  const id = provider.toHexString() + "-" + receiver.toHexString();
  let entity = LiquidityPosition.load(id);
  if (entity == null) {
    entity = new LiquidityPosition(id);
    entity.provider = provider;
    entity.receiver = receiver;
    entity.shares = ZERO;
    entity.amount0Added = ZERO;
    entity.amount1Added = ZERO;
    entity.amount0Removed = ZERO;
    entity.amount1Removed = ZERO;
    entity.updatedAtBlock = ZERO;
    entity.updatedAtTimestamp = ZERO;
  }
  return entity;
}

function getOrCreateProposal(proposalId: BigInt, event: ethereum.Event): Proposal {
  let entity = Proposal.load(proposalId.toString());
  if (entity == null) {
    entity = new Proposal(proposalId.toString());
    entity.proposer = event.transaction.from;
    entity.description = "";
    entity.voteStart = ZERO;
    entity.voteEnd = ZERO;
    entity.status = "Unknown";
    entity.createdTransactionHash = event.transaction.hash;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
  }
  return entity;
}
