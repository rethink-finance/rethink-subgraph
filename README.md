Rethink Subgraph
This repository contains the subgraph code for indexing and querying data on the Rethink platform. The subgraph provides a way to index and retrieve on-chain data efficiently using The Graph protocol.

Getting Started
Prerequisites
Ensure that you have Node.js and npm installed. You’ll also need access to a Graph Node or a Graph Studio account to deploy and manage the subgraphs.

Installation
Clone this repository to your local machine.

Copy the example environment file to configure the .env file.

bash
Copy code
cp .env.example .env
Install dependencies:

bash
Copy code
npm install
Deployment
Run the following command to deploy or update the subgraph:

bash
Copy code
npm run deploy
During deployment, you’ll be prompted to specify versions for each subgraph. Choose the appropriate version number for each.
