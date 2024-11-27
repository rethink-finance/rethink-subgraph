# Rethink Subgraph

This repository contains the subgraph code for indexing and querying data on the Rethink platform. The subgraph provides a way to index and retrieve on-chain data efficiently using The Graph protocol.

## Getting Started

### Prerequisites

Ensure that you have **Node.js** and **npm** installed. You’ll also need access to a **Graph Node** or a **Graph Studio** account to deploy and manage the subgraphs.

### Installation

Clone this repository to your local machine.

Copy the example environment file to configure the `.env` file.
Install dependencies.
Run the subgraph-deployer.


```bash
cp .env.example .env

npm install

npm run deploy
```



## TODO
1) [Deploy to multiple networks](https://thegraph.com/docs/en/deploying/multiple-networks/)

## Debugging
Query IPFS hashes with:
```shell
https://api.thegraph.com/ipfs/api/v0/cat?arg=QmQKXcNQQRdUvNRMGJiE2idoTu9fo5F5MRtKztH4WyKxED
```
Or use [this query web interface](https://api.studio.thegraph.com/query/42291/rethink-base/v2.0.2/graphql?query=query+MyQuery+%7B%0A++events+%7B%0A++++id%0A++%7D%0A%7D) to query any subgraph.
```shell
https://api.studio.thegraph.com/query/42291/rethink-base/v2.0.2/graphql?query=query+MyQuery+%7B%0A++events+%7B%0A++++id%0A++%7D%0A%7D
```

## Local Node Debugging
Run local node, follow extensive [setup instructions](https://github.com/graphprotocol/graph-node) to run your own IPFS graph node

Install local graph-node.
```bash
git clone https://github.com/graphprotocol/graph-node
cd graph-node/docker

# Adjust docker-compose.yml, for example for base network use:
#     environment:
#      ethereum: 'base:https://base.llamarpc.com'

# Start
docker compose up
```

Create subgraph and deploy it to the local node.
```shell
cd subgraphs/rethink
# Copy network that you want to debug
cp rethink-base.yaml subgraph.yaml
graph codegen && graph build


# if it doesn't exist yet, create it with:
graph create rethink-base --node http://127.0.0.1:8020

# Deploy to your local graph node using debug-fork, that will copy the existing deployed id.
# graph deploy <subgraph-name>> --debug-fork <deployment-id> --ipfs http://localhost:5001 --node http://127.0.0.1:8020

# Example:
graph deploy rethink-base --debug-fork QmQCbbFRLybTcC83jLiRJ5mfz6DudVEtkWDiWGRtofRCtB --ipfs http://localhost:5001 --node http://127.0.0.1:8020
```

