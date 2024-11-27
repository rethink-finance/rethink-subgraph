import { execSync } from "child_process"
import { config as dotenvConfig } from "dotenv"
import fs from "fs"
import path, { resolve } from "path"
import { v4 as uuidv4 } from "uuid"

dotenvConfig({ path: resolve(__dirname, ".env") })

const GRAPH_NODE_TYPE = process.env.GRAPH_NODE_TYPE
const GRAPH_DEPLOYMENT_KEY = process.env.GRAPH_DEPLOYMENT_KEY

enum GRAPH_NODE {
	LOCAL = "local",
	STUDIO = "studio",
}

interface SubgraphConfig {
	datasourceName: string
	subgraphSlug: string
}

const subgraphConfigs: SubgraphConfig[] = [
	{
		datasourceName: "rethinkfinance",
		subgraphSlug: "rethinkfinance-base",
	},
	{
		datasourceName: "rethinkfinance",
		subgraphSlug: "rethinkfinance-arbitrum-one",
	},
	{
		datasourceName: "rethinkfinance",
		subgraphSlug: "rethinkfinance-mainnet",
	},
	{
		datasourceName: "rethinkfinance",
		subgraphSlug: "rethinkfinance-matic",
	},
	// Add more subgraph configurations here if needed
]

// Execute Child Processes
const srcDir = path.join(__dirname)
export const exec = (cmd: string, cwdDir?: string) => {
	try {
		return execSync(cmd, { cwd: cwdDir ?? srcDir, stdio: "inherit" })
	} catch (e) {
		throw new Error(`Failed to run command \`${cmd}\``)
	}
}

let executedDeployments: number = 0

;(async function () {
	if (!GRAPH_NODE_TYPE) {
		throw new Error("Please set a GRAPH_NODE_TYPE in a .env file")
	}

	if (GRAPH_NODE_TYPE === GRAPH_NODE.STUDIO && !GRAPH_DEPLOYMENT_KEY) {
		throw new Error("Please set your GRAPH_DEPLOYMENT_KEY in a .env file")
	}

	// Compile the solidity contracts
	// console.log('⛓  ### Compiling the smart contracts...');
	// exec(`npm run compile`);

	for (const { datasourceName, subgraphSlug } of subgraphConfigs) {
		try {
			// Display deployment index
			console.log(`✨ ### DEPLOY ${executedDeployments + 1}/${subgraphConfigs.length} (${datasourceName}/${subgraphSlug}...`)

			// Define the subgraph YAML file path
			const subgraphYamlPath = path.join(srcDir, "subgraphs", datasourceName, `${subgraphSlug}.yaml`)

			if (!fs.existsSync(subgraphYamlPath)) {
				throw new Error(`Subgraph YAML file not found: ${subgraphYamlPath}`)
			}

			// Merge legacy events into current ABIs
			mergeLegacyEvents(datasourceName)

			// Create a temporary directory
			const tempDir = path.join(srcDir, "temp", uuidv4())
			fs.mkdirSync(tempDir, { recursive: true })

			// Copy the contents of the subgraph YAML file to a temporary file
			const tempYamlPath = path.join(tempDir, "subgraph.yaml")
			fs.copyFileSync(subgraphYamlPath, tempYamlPath)

			// Deploy subgraph from the temporary directory
			console.log("🏎  ### Deploying subgraph...")

			switch (GRAPH_NODE_TYPE) {
				case GRAPH_NODE.STUDIO:
					taskDeployToStudio(tempDir, datasourceName, subgraphSlug)
					break
				case GRAPH_NODE.LOCAL:
				default:
					taskDeployToLocal(tempDir, datasourceName, subgraphSlug)
			}

			console.log("🦾 ### Done. (Deploy.)")

			// Increment deployment counter
			executedDeployments++
		} catch (error) {
			console.error(error)
		}
	}

	console.log(`${executedDeployments === 0 ? "fail" : "success"} ### ${executedDeployments} Deployment(s) Successful!`)
})()

function findFilesInDirectory(directory: string): string[] {
	let files: string[] = []
	fs.readdirSync(directory).forEach((file) => {
		const fullPath = path.join(directory, file)
		if (fs.statSync(fullPath).isDirectory()) {
			files = [...files, ...findFilesInDirectory(fullPath)] // Recurse into subdirectories
		} else {
			files.push(fullPath) // Add file to the list
		}
	})
	return files
}

/**
 * mergeLegacyEvents()
 *
 * Merges legacy events from abis_legacy into abis_current and saves them in the abis folder
 * @param datasourceName
 */
function mergeLegacyEvents(datasourceName: string) {
	const currentAbisDir = resolve(srcDir, "subgraphs", datasourceName, "abis_current")
	const legacyAbisDir = resolve(srcDir, "subgraphs", datasourceName, "abis_legacy")
	const finalAbisDir = resolve(srcDir, "subgraphs", datasourceName, "abis")

	if (!fs.existsSync(finalAbisDir)) {
		fs.mkdirSync(finalAbisDir, { recursive: true })
	}

	// Get all files from the abis_current directory
	const currentFiles = findFilesInDirectory(currentAbisDir)

	currentFiles.forEach((currentPath) => {
		const relativePath = path.relative(currentAbisDir, currentPath) // Get the relative path
		const legacyPath = path.join(legacyAbisDir, relativePath) // Find corresponding file in abis_legacy
		const finalPath = path.join(finalAbisDir, relativePath) // Where the merged file will be saved

		// Ensure directory exists in the final abis folder
		fs.mkdirSync(path.dirname(finalPath), { recursive: true })

		// Load current ABI
		const currentABI = JSON.parse(fs.readFileSync(currentPath, "utf8"))

		// Check if matching legacy file exists
		if (fs.existsSync(legacyPath)) {
			const legacyABI = JSON.parse(fs.readFileSync(legacyPath, "utf8"))

			// Merge legacy events into current ABI
			currentABI.push(...legacyABI)
			console.log(`Merged legacy events into: ${finalPath}`)
		} else {
			console.log(`No legacy events found for: ${relativePath}, copying current ABI.`)
		}

		// Save the result (merged or copied) to the final abis directory
		fs.writeFileSync(finalPath, JSON.stringify(currentABI, null, 2))
	})

	console.log(`✅ Merging complete for ${datasourceName}!`)
}
/**
 * taskGraphCodegen()
 *
 * Runs the code generation
 * @param datasourceName
 * @param datasourcePath
 */
function taskGraphCodegen(datasourceName: string, datasourcePath: string) {
	// Create the graph code generation files
	console.log(" ### 1/2 Creating the graph scheme for...", datasourceName)
	exec(`graph codegen`, datasourcePath)
}

/**
 * taskGraphBuild()
 *
 * Builds the graph scheme
 * @param datasourceName
 * @param datasourcePath
 */
function taskGraphBuild(datasourceName: string, datasourcePath: string) {
	// Building the graph scheme
	console.log(" ### 2/2 Building the graph scheme for...", datasourceName)
	exec(`graph build`, datasourcePath)
}

/**
 * taskDeployToStudio()
 *
 * Deploys subgraph to The Graph decentralized service
 * @param tempDir
 * @param subgraphSlug
 */
function taskDeployToStudio(tempDir: string, dataSourceName: string, subgraphSlug: string) {
	console.log(
		`==== READY TO DEPLOY SUBGRAPH... ${dataSourceName} ====
		IMPORTANT: When prompted, enter a version label for the subgraph!`,
	)

	// Copy all the required files to the temporary directory
	copyFilesToTempDir(tempDir, dataSourceName)

	// Build the subgraph code generation files
	taskGraphCodegen(dataSourceName, tempDir)

	// Build the subgraph schema
	taskGraphBuild(dataSourceName, tempDir)

	// Deploy subgraph from the temporary directory
	console.log("🏎  ### Deploying subgraph...", subgraphSlug)

	exec(`graph auth --studio ${GRAPH_DEPLOYMENT_KEY}`, tempDir)
	exec(`graph deploy --studio ${subgraphSlug}`, tempDir)

	// Delete the temporary directory after deployment
	fs.rmdirSync(tempDir, { recursive: true })
}

/**
 * taskDeployToLocal()
 *
 * Allocates the subgraph name in the Graph Node and deploys the subgraphs to your local Graph Node
 * @param tempDir
 * @param subgraphSlug
 */
function taskDeployToLocal(tempDir: string, dataSourceName: string, subgraphSlug: string) {
	// Copy all the required files to the temporary directory
	copyFilesToTempDir(tempDir, dataSourceName)

	// Build the subgraph code generation files
	taskGraphCodegen(dataSourceName, tempDir)

	// Build the subgraph schema
	taskGraphBuild(dataSourceName, tempDir)

	// Deploy subgraph from the temporary directory
	exec(`graph create subgraph.yaml --node http://127.0.0.1:8020`, tempDir)
	exec(`graph deploy subgraph.yaml --ipfs http://127.0.0.1:5001 --node http://127.0.0.1:8020`, tempDir)

	// Delete the temporary directory after deployment
	fs.rmdirSync(tempDir, { recursive: true })
}

/**
 * Copy all the required files to the temporary directory
 * @param tempDir
 * @param subgraphSlug
 */
function copyFilesToTempDir(tempDir: string, subgraphSlug: string) {
	const subgraphPath = resolve(__dirname, "subgraphs", subgraphSlug)

	// Copy the contents of the subgraph directory to the temporary directory
	exec(`cp -R ${subgraphPath}/* ${tempDir}`)
}
