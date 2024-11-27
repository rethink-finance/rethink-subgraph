import { transactions } from "@amxx/graphprotocol-utils"
import { GovernableFund, Governor, VotingContract } from "../generated/schema"

import { Address } from "@graphprotocol/graph-ts"
import { GovernableFundFactory_CreatedAndInitializedFundEvent } from "../generated/GovernableFundFactory/GovernableFundFactory"
import { ERC20Votes, RethinkFundGovernor } from "../generated/templates"
import { fetchGovernor } from "../utils/RethinkFundGovernor.util"
import { fetchVoting } from "../utils/Voting.util"

export function handleGovernableFundFactory_CreatedAndInitializedFundEvent(
	event: GovernableFundFactory_CreatedAndInitializedFundEvent,
): void {
	let governor = createGovernorTemplate(event.params.govContractAddr)
	let voting = createVotingTemplate(event.params.governanceToken)
	let fund = new GovernableFund(event.params.fundContractAddr)
	fund.transaction = transactions.log(event).id
	fund.governor = governor.id
	fund.votingContract = voting.id
	fund.fundName = event.params.fundName
	fund.fundContractAddr = event.params.fundContractAddr
	fund.govContractAddr = event.params.govContractAddr
	fund.safeProxyAddr = event.params.safeProxyAddr
	fund.rolesModifier = event.params.rolesModifier
	fund.governanceToken = event.params.governanceToken
	fund.save()
}

function createGovernorTemplate(governorAddress: Address): Governor {
	RethinkFundGovernor.create(governorAddress)
	let governor = fetchGovernor(governorAddress)
	return governor
}

function createVotingTemplate(votingAddress: Address): VotingContract {
	ERC20Votes.create(votingAddress)
	let voting = fetchVoting(votingAddress)
	return voting
}
